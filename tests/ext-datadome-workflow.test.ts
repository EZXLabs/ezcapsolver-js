import { createHash } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { EzCapSolverClient } from "../src/client.js";
import { isApiError, isTransportError } from "../src/errors.js";
import {
  type DataDomeChallenge,
  isDataDomeError,
  solveDataDomeWorkflow,
} from "../src/ext/index.js";

/**
 * The DataDome workflow end to end, against one local server standing in for
 * the protected site, DataDome, and the EzCaptchaSolver API. The browser side
 * runs on the real lkrequest-js addon.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
const INTERCEPTED_PAGE = "<html><script>var dd={'rt':'c','cid':'abc'}</script></html>";
const SLIDER_SCRIPT = "/** DataDome v1.34.0 96eb15b */\n!function A(){}();\nvar g=1;";
const INTERSTITIAL_SCRIPT = "/* DataDome v1.33.1 d5110df */\n;(function(){var A={};})()";
const RAW_COOKIE =
  "datadome=abc123; Max-Age=31536000; Domain=.example.com; Path=/; Secure; SameSite=Lax";
const COOKIE_VERDICT = JSON.stringify({ view: "redirect", cookie: RAW_COOKIE });
const EXPECTED_COOKIE = {
  name: "datadome",
  value: "abc123",
  domain: ".example.com",
  raw: RAW_COOKIE,
};

/** What the server recorded of one browser-side request. */
interface Seen {
  headers: IncomingHttpHeaders;
  /** Header names and values as sent, duplicates included. */
  rawHeaders: string[];
  body: string;
}

/** A page the server serves on `METHOD /path`. */
interface Page {
  status?: number;
  body: string;
}

/** The local server, and everything it was sent. */
interface World {
  base: string;
  seen: Map<string, Seen[]>;
  tasks: Array<Record<string, unknown>>;
}

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

/**
 * Starts the server. `pages` maps `METHOD /path` to a page; the API answers
 * each DataDome step with the solution given for it.
 */
async function world(
  pages: (base: string) => Record<string, Page>,
  solutions: (base: string) => Record<string, unknown> = () => ({}),
): Promise<World> {
  const state: World = { base: "", seen: new Map(), tasks: [] };
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const route = `${request.method} ${new URL(request.url ?? "/", state.base).pathname}`;
      if (route === "POST /createSyncTask") {
        const task = (JSON.parse(body) as { task: Record<string, unknown> }).task;
        state.tasks.push(task);
        const solution = solutions(state.base)[String(task["step"])] ?? {};
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ errorId: 0, taskId: "t", status: "ready", solution }));
        return;
      }
      state.seen.set(route, [
        ...(state.seen.get(route) ?? []),
        { headers: request.headers, rawHeaders: request.rawHeaders, body },
      ]);
      const page = pages(state.base)[route];
      response.writeHead(page?.status ?? (page ? 200 : 404));
      response.end(page?.body ?? "");
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  state.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return state;
}

/** An API client pointed at the server. */
function clientOf(w: World): EzCapSolverClient {
  return new EzCapSolverClient({
    clientKey: "test-client-key",
    asyncBaseUrl: w.base,
    syncBaseUrl: w.base,
  });
}

/** A run against the server's /signup page. */
function challengeOf(w: World): DataDomeChallenge {
  return { targetUrl: `${w.base}/signup`, userAgent: USER_AGENT };
}

/** The only request a route got. */
function onlyRequest(w: World, route: string): Seen {
  const requests = w.seen.get(route) ?? [];
  expect(requests, route).toHaveLength(1);
  return requests[0] as Seen;
}

/** Base64 the way the service expects it. */
function encode(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

describe("the DataDome workflow", () => {
  it("sends an uncached slider script in full", async () => {
    const challengePage = `<html><script>var ddm={};\n${SLIDER_SCRIPT}</script></html>`;
    const w = await world(
      () => ({
        "GET /signup": { status: 403, body: INTERCEPTED_PAGE },
        "GET /captcha/": { body: challengePage },
        "GET /captcha/check": { body: COOKIE_VERDICT },
      }),
      (base) => ({
        "1": { url: `${base}/captcha/?initialCid=abc` },
        "2": { status: false },
        "3": { url: `${base}/captcha/check?cid=abc`, kind: "slider", submit_after_ms: 1 },
      }),
    );

    expect(await solveDataDomeWorkflow(clientOf(w), challengeOf(w))).toEqual(EXPECTED_COOKIE);

    const target = onlyRequest(w, "GET /signup");
    expect(target.headers["user-agent"]).toBe(USER_AGENT);
    // Node keeps only the first of a repeated user-agent, so count what was sent.
    for (const name of ["user-agent", "accept-encoding"]) {
      const sent = target.rawHeaders.filter(
        (value, i) => i % 2 === 0 && value.toLowerCase() === name,
      );
      expect(sent, name).toHaveLength(1);
    }
    expect(onlyRequest(w, "GET /captcha/").headers.referer).toBe(`${w.base}/signup`);
    onlyRequest(w, "GET /captcha/check");

    const [first, second, third] = w.tasks;
    expect(w.tasks).toHaveLength(3);
    expect(first).toMatchObject({
      type: "DataDomeTaskProxyless",
      step: "1",
      html_b64: encode(INTERCEPTED_PAGE),
      referer: `${w.base}/signup`,
      user_agent: USER_AGENT,
    });
    expect(second).toMatchObject({ step: "2" });
    expect(second).not.toHaveProperty("html_b64");
    expect(third).toMatchObject({
      step: "3",
      html_b64: encode(challengePage),
      referer: `${w.base}/captcha/?initialCid=abc`,
      user_agent: USER_AGENT,
      external_js_base64: encode(SLIDER_SCRIPT),
    });
    expect(third).not.toHaveProperty("external_js_hash");
  });

  it("sends only the hash of a cached interstitial script, and posts the answer", async () => {
    const challengePage = `<html><script>var ddm={};\n${INTERSTITIAL_SCRIPT};\nvar glue='cid=abc';</script></html>`;
    const w = await world(
      () => ({
        "GET /signup": { status: 403, body: INTERCEPTED_PAGE },
        "GET /interstitial/": { body: challengePage },
        "POST /interstitial/check": { body: COOKIE_VERDICT },
      }),
      (base) => ({
        "1": { url: `${base}/interstitial/?initialCid=abc` },
        "2": { status: true },
        "3": { url: `${base}/interstitial/check`, body: "payload=1" },
      }),
    );

    expect(await solveDataDomeWorkflow(clientOf(w), challengeOf(w))).toEqual(EXPECTED_COOKIE);

    // The interstitial frame only gets the origin of the page.
    expect(onlyRequest(w, "GET /interstitial/").headers.referer).toBe(w.base);
    const submitted = onlyRequest(w, "POST /interstitial/check");
    expect(submitted.headers["content-type"]).toBe(
      "application/x-www-form-urlencoded; charset=UTF-8",
    );
    expect(submitted.body).toBe("payload=1");

    // The bundle ends at its closing `})()`, and the banner stays out of the hash.
    const hash = createHash("md5").update(";(function(){var A={};})()").digest("hex");
    expect(w.tasks[1]).toMatchObject({ step: "2", hash });
    expect(w.tasks[2]).toMatchObject({ step: "3", external_js_hash: hash });
    expect(w.tasks[2]).not.toHaveProperty("external_js_base64");
  });

  it("costs no task when DataDome lets the page through", async () => {
    const w = await world(() => ({ "GET /signup": { body: "<html>welcome</html>" } }));

    expect(await solveDataDomeWorkflow(clientOf(w), challengeOf(w))).toBeUndefined();
    expect(w.tasks).toHaveLength(0);
  });

  it("reports a block page as a ban", async () => {
    const w = await world(() => ({
      "GET /signup": { status: 403, body: "<script>var dd={'t':'bv'}</script>hardblock" },
    }));

    const error = await solveDataDomeWorkflow(clientOf(w), challengeOf(w)).catch((e) => e);
    expect(isDataDomeError(error) && error.blocked).toBe(true);
    expect(w.tasks).toHaveLength(0);
  });

  it("stops waiting to submit once the signal aborts", async () => {
    const w = await world(
      () => ({
        "GET /signup": { status: 403, body: INTERCEPTED_PAGE },
        "GET /captcha/": { body: `<script>${SLIDER_SCRIPT}</script>` },
        "GET /captcha/check": { body: COOKIE_VERDICT },
      }),
      (base) => ({
        "1": { url: `${base}/captcha/` },
        "2": { status: true },
        "3": { url: `${base}/captcha/check`, kind: "slider", submit_after_ms: 60_000 },
      }),
    );

    const signal = AbortSignal.timeout(500);
    const error = await solveDataDomeWorkflow(clientOf(w), challengeOf(w), { signal }).catch(
      (e) => e,
    );
    expect(isTransportError(error)).toBe(true);
    expect(w.seen.has("GET /captcha/check")).toBe(false);
  });

  it("passes an API error through as the client threw it", async () => {
    const w = await world(() => ({ "GET /signup": { status: 403, body: INTERCEPTED_PAGE } }));
    const failing = new EzCapSolverClient({
      clientKey: "test-client-key",
      fetch: async () =>
        new Response(JSON.stringify({ errorId: 1, errorCode: "ERROR_ZERO_BALANCE" }), {
          status: 200,
        }),
    });

    const error = await solveDataDomeWorkflow(failing, challengeOf(w)).catch((e) => e);
    expect(isApiError(error) && error.errorCode).toBe("ERROR_ZERO_BALANCE");
  });

  it("rejects an unusable challenge before sending anything", async () => {
    const w = await world(() => ({}));
    for (const challenge of [
      { targetUrl: "/signup", userAgent: USER_AGENT },
      { targetUrl: w.base, userAgent: "Mozilla/5.0 Firefox/133.0" },
      { targetUrl: w.base, userAgent: "Chrome/120.0.0.0" },
      { targetUrl: w.base, userAgent: USER_AGENT, proxy: "::not a proxy" },
    ]) {
      const error = await solveDataDomeWorkflow(clientOf(w), challenge).catch((e) => e);
      expect(isDataDomeError(error), JSON.stringify(challenge)).toBe(true);
    }
    expect(w.seen.size).toBe(0);
  });
});
