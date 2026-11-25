/**
 * The DataDome challenge workflow.
 *
 * @module
 */

import type { RequestOptions, Session } from "lkrequest-js";

import type { CallOptions, EzCapSolverClient } from "../../client.js";
import { EzCaptchaError } from "../../errors.js";
import type { DataDomeSolution } from "../../solutions.js";
import { sleep } from "../../transport.js";
import { BrowserRequestError, DataDomeError } from "../errors.js";
import { BrowserProfile, type Headers } from "./browser.js";
import {
  encodeText,
  externalScriptUrl,
  inlineScript,
  isChallenged,
  isHardBlocked,
  isSlider,
  scriptHash,
} from "./page.js";
import { type DataDomeChallenge, type DataDomeCookie, DEFAULT_ACCEPT_LANGUAGE } from "./types.js";
import { readVerdict, type Submission, submissionFrom, submitDelayMs } from "./verdict.js";

/** Time limit of each browser-side request. */
const BROWSER_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Clears the DataDome challenge in front of a page and returns the cookie
 * DataDome issues for it.
 *
 * Only the page address and a browser identity are needed; the whole flow runs
 * inside this call:
 *
 * 1. Fetch the target page. A page DataDome did not intercept ends the run
 *    with `undefined`.
 * 2. Step one finds the challenge address, and the challenge page is fetched.
 * 3. The challenge script is read from that page, or fetched from DataDome's
 *    CDN when the page links it.
 * 4. Step two asks whether the service already caches the script.
 * 5. Step three computes the answer, sending the whole script only when it is
 *    not cached.
 * 6. The answer is submitted after the delay it asks for, and the cookie in
 *    DataDome's response is returned.
 *
 * Steps one to three are `DataDomeTaskProxyless` tasks on the synchronous
 * endpoint, so a challenged page costs three tasks. Browser-side requests go
 * through `challenge.proxy` with the Chrome TLS fingerprint of
 * `challenge.userAgent`, sent by `lkrequest-js`, which has to be installed
 * alongside this package.
 *
 * ```ts
 * import { solveDataDomeWorkflow } from "ezcapsolver-js/ext";
 *
 * const cookie = await solveDataDomeWorkflow(client, {
 *   targetUrl: "https://example.com/signup",
 *   userAgent,
 *   proxy: "http://user:pass@host:port",
 * });
 * ```
 *
 * @throws DataDomeError when the run cannot go on, with `blocked` set when
 *   DataDome banned the IP — retry through a different proxy.
 * @throws BrowserRequestError when a request to the protected site or to
 *   DataDome fails.
 * @throws EzCaptchaError of kind `config` when `lkrequest-js` cannot be loaded.
 * @throws Any error of the API calls, as from
 *   {@link EzCapSolverClient.syncSolveDataDomeTaskProxyless}. Aborting
 *   `options.signal` during the wait before submitting throws a
 *   `TransportError`, as an aborted poll does.
 */
export async function solveDataDomeWorkflow(
  client: EzCapSolverClient,
  challenge: DataDomeChallenge,
  options: CallOptions = {},
): Promise<DataDomeCookie | undefined> {
  const target = parseUrl(challenge.targetUrl, "targetUrl");
  const browser = await Browser.open(challenge, options.signal);
  try {
    const page = await browser.get(target.href, browser.profile.navigation());
    if (isHardBlocked(page)) throw blocked("the target page");
    if (!isChallenged(page)) return undefined;
    const run = new DataDomeRun(client, browser, target, challenge.userAgent, options.signal);
    return await run.clear(page);
  } finally {
    browser.close();
  }
}

/** One run against an intercepted page: the API client, the browser, and the page it started from. */
class DataDomeRun {
  constructor(
    private readonly client: EzCapSolverClient,
    private readonly browser: Browser,
    private readonly target: URL,
    private readonly userAgent: string,
    private readonly signal: AbortSignal | undefined,
  ) {}

  /** Takes an intercepted page through steps one to three and the submission. */
  async clear(page: string): Promise<DataDomeCookie> {
    const challengeUrl = await this.locateChallenge(page);
    const frameHeaders = this.browser.profile.challengeFrame(this.target, isSlider(challengeUrl));
    const challengePage = await this.browser.get(challengeUrl.href, frameHeaders);
    if (isHardBlocked(challengePage)) throw blocked("the challenge page");
    const loadedAt = Date.now();

    const script = await this.browser.challengeScript(challengePage, challengeUrl);
    const answer = await this.answer(challengePage, challengeUrl, script);
    const submission = submissionFrom(answer);
    const wait = submitDelayMs(answer, submission) - (Date.now() - loadedAt);
    if (wait > 0) {
      await sleep(wait, this.signal, "wait before submitting the DataDome answer");
    }
    const verdict = await this.browser.submit(submission, challengeUrl);
    return readVerdict(verdict, this.target);
  }

  /** Step one: asks the service where the challenge of an intercepted page lives. */
  private async locateChallenge(page: string): Promise<URL> {
    const solved = await this.client.syncSolveDataDomeTaskProxyless(
      {
        step: "1",
        html_b64: encodeText(page),
        referer: this.target.href,
        user_agent: this.userAgent,
      },
      { signal: this.signal },
    );
    const url = solved.solution.url;
    if (!url) throw new DataDomeError("step 1 returned no challenge url");
    return parseUrl(url, "the step 1 challenge url");
  }

  /**
   * Steps two and three: asks whether the service caches the script, then for
   * the answer, sending the script itself only when it is not cached.
   */
  private async answer(
    challengePage: string,
    challengeUrl: URL,
    script: string,
  ): Promise<DataDomeSolution> {
    const hash = scriptHash(script);
    const cached = await this.scriptCached(hash);
    const solved = await this.client.syncSolveDataDomeTaskProxyless(
      {
        step: "3",
        html_b64: encodeText(challengePage),
        referer: challengeUrl.href,
        user_agent: this.userAgent,
        ...(cached ? { external_js_hash: hash } : { external_js_base64: encodeText(script) }),
      },
      { signal: this.signal },
    );
    return solved.solution;
  }

  /**
   * Step two: whether the service already caches the script with this hash. An
   * answer without `status` counts as not cached, which only means the script
   * is sent in full.
   */
  private async scriptCached(hash: string): Promise<boolean> {
    const solved = await this.client.syncSolveDataDomeTaskProxyless(
      { step: "2", hash },
      { signal: this.signal },
    );
    return solved.solution.status === true;
  }
}

/**
 * The browser side of a run: one cookie-keeping session with a Chrome TLS
 * fingerprint, and the identity its requests present.
 */
class Browser {
  private constructor(
    readonly profile: BrowserProfile,
    private readonly session: Session,
    private readonly signal: AbortSignal | undefined,
  ) {}

  /** Opens the session a run goes through. The caller closes it. */
  static async open(
    challenge: DataDomeChallenge,
    signal: AbortSignal | undefined,
  ): Promise<Browser> {
    const profile = new BrowserProfile(
      challenge.userAgent,
      challenge.acceptLanguage ?? DEFAULT_ACCEPT_LANGUAGE,
    );
    const preset = profile.tlsPreset();
    const { Client } = await loadLkrequest();
    const client = new Client({ preset, timeouts: { total: BROWSER_REQUEST_TIMEOUT_MS } });
    try {
      const session = client.session(
        challenge.proxy === undefined ? {} : { proxy: challenge.proxy },
      );
      return new Browser(profile, session, signal);
    } catch (cause) {
      throw new DataDomeError("proxy is not usable", { cause });
    }
  }

  /**
   * Sends a GET and returns the response body.
   *
   * The status is not checked: DataDome answers an intercepted page with an
   * error status, and the body is what tells the cases apart.
   */
  get(url: string, headers: Headers): Promise<string> {
    return this.send(url, { method: "GET", headers });
  }

  /** Sends a form POST and returns the response body. */
  post(url: string, headers: Headers, body: string): Promise<string> {
    return this.send(url, { method: "POST", headers, body });
  }

  /** The challenge script: fetched from the CDN when the page links it, read from the page otherwise. */
  async challengeScript(page: string, challengeUrl: URL): Promise<string> {
    const src = externalScriptUrl(page);
    if (src === undefined) {
      const script = inlineScript(page);
      if (script === undefined) {
        throw new DataDomeError("the challenge page carries no challenge script");
      }
      return script;
    }
    const script = await this.get(src, this.profile.script(challengeUrl));
    if (script.trim() === "") throw new DataDomeError("the external challenge script is empty");
    return script;
  }

  /** Hands the answer to DataDome and returns its response body. */
  submit(submission: Submission, challengeUrl: URL): Promise<string> {
    const post = submission.body !== undefined;
    const headers = this.profile.submission(challengeUrl, post);
    return submission.body === undefined
      ? this.get(submission.url, headers)
      : this.post(submission.url, headers, submission.body);
  }

  /** Releases the session's connections. */
  close(): void {
    this.session.close();
  }

  /**
   * Sends a request and reads its body. A failure names the request without
   * its query, which carries session identifiers and can run long.
   */
  private async send(url: string, init: RequestOptions): Promise<string> {
    try {
      const response = await this.session.request(url, {
        ...init,
        ...(this.signal === undefined ? {} : { signal: this.signal }),
      });
      return await response.text();
    } catch (cause) {
      throw new BrowserRequestError(`${init.method} ${url.split("?")[0]}`, { cause });
    }
  }
}

/** lkrequest-js, loaded on first use so that a missing install fails with a clear message. */
async function loadLkrequest(): Promise<typeof import("lkrequest-js")> {
  try {
    return await import("lkrequest-js");
  } catch (cause) {
    throw new EzCaptchaError(
      "solveDataDomeWorkflow needs the lkrequest-js package; install it with `npm install lkrequest-js`",
      "config",
      { cause },
    );
  }
}

/** Parses an address the run has to request, naming it in the error. */
function parseUrl(address: string, what: string): URL {
  try {
    return new URL(address);
  } catch (cause) {
    throw new DataDomeError(`${what} "${address}" is not a valid URL`, { cause });
  }
}

/** The error for a page DataDome serves to a banned visitor. */
function blocked(what: string): DataDomeError {
  return new DataDomeError(`${what} is a block page`, { blocked: true });
}
