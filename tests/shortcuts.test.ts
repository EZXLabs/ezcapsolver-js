import { describe, expect, it } from "vitest";

import { EzCapSolverClient } from "../src/client.js";
import { KNOWN_TASK_TYPES, type KnownTaskType } from "../src/task-type.js";

/**
 * Minimal valid parameters for each modelled type.
 *
 * The point of this table is not the values but the coverage: every one of the
 * 46 named methods is actually invoked, and the type string it puts on the wire
 * is checked against the constant. A typo in any forward would otherwise bill a
 * task as a different type while the caller decodes it as the one they asked
 * for — a failure that costs money and produces no error.
 */
const PARAMS: Record<KnownTaskType, Record<string, unknown>> = {
  ReCaptchaV2TaskProxyless: { websiteURL: "u", websiteKey: "k" },
  ReCaptchaV2TaskProxylessS9: { websiteURL: "u", websiteKey: "k" },
  ReCaptchaV2STaskProxyless: { websiteURL: "u", websiteKey: "k" },
  ReCaptchaV2EnterpriseTaskProxyless: { websiteURL: "u", websiteKey: "k" },
  ReCaptchaV2SEnterpriseTaskProxyless: { websiteURL: "u", websiteKey: "k" },
  ReCaptchaV2Classification: { image: "i", question: "q" },
  ReCaptchaV3TaskProxyless: { websiteURL: "u", websiteKey: "k" },
  ReCaptchaV3TaskProxylessS9: { websiteURL: "u", websiteKey: "k" },
  ReCaptchaV3EnterpriseTaskProxyless: { websiteURL: "u", websiteKey: "k" },
  ReCaptchaV3EnterpriseTaskProxylessS9: { websiteURL: "u", websiteKey: "k" },
  FuncaptchaTaskProxyless: { websiteURL: "u", websiteKey: "k" },
  FunCaptchaClassification: { image: "i", question: "q" },
  PerimeterX: { websiteKey: "k" },
  HCaptcha: { websiteURL: "u", websiteKey: "k", lang: "en-US", invisible: false },
  HCaptchaClassification: { image: "i" },
  AkamaiWEBTaskProxyless: { pageUrl: "p", v3Url: "v", ua: "u", lang: "l" },
  AkamaiSBSDTaskProxyless: {
    pageUrl: "p",
    sbsdUrl: "s",
    bmSo: "b",
    ua: "u",
    lang: "l",
    script_base64: "x",
  },
  TlsTask: { tls_type: "c", proxy: "p", url: "u" },
  CloudFlare5STask: { websiteURL: "u", proxy: "p" },
  CloudFlareTurnstileTask: { websiteURL: "u", websiteKey: "k" },
  DataDomeTaskProxyless: { html_b64: "h" },
  DataDomeTagsTaskProxyless: { ddk: "d", referer: "r", ua: "u" },
  IncapsulaTaskProxyless: { script: "s", scriptUrl: "su", pageUrl: "p", ua: "u" },
};

/** A solution that satisfies whatever fields the type is known to always return. */
const SOLUTIONS: Partial<Record<KnownTaskType, Record<string, unknown>>> = {
  ReCaptchaV2TaskProxyless: { gRecaptchaResponse: "t" },
  ReCaptchaV2TaskProxylessS9: { gRecaptchaResponse: "t" },
  ReCaptchaV2STaskProxyless: { gRecaptchaResponse: "t" },
  ReCaptchaV2EnterpriseTaskProxyless: { gRecaptchaResponse: "t" },
  ReCaptchaV2SEnterpriseTaskProxyless: { gRecaptchaResponse: "t" },
  ReCaptchaV3TaskProxyless: { gRecaptchaResponse: "t" },
  ReCaptchaV3TaskProxylessS9: { gRecaptchaResponse: "t" },
  ReCaptchaV3EnterpriseTaskProxyless: { gRecaptchaResponse: "t" },
  ReCaptchaV3EnterpriseTaskProxylessS9: { gRecaptchaResponse: "t" },
  FuncaptchaTaskProxyless: { token: "t" },
  CloudFlareTurnstileTask: { token: "t" },
  HCaptcha: { generated_pass_UUID: "t" },
  PerimeterX: { _px3: "t" },
  AkamaiWEBTaskProxyless: { payload: "t" },
  AkamaiSBSDTaskProxyless: { payload: "t" },
  IncapsulaTaskProxyless: { data: "t" },
};

/** A client whose transport records every task object it was asked to send. */
function recordingClient() {
  const sent: Record<string, unknown>[] = [];
  // The second request on the asynchronous path is getTaskResult, whose body
  // carries no task — so the type has to be remembered from the creating call
  // to reply with a solution of the right shape.
  let pending: KnownTaskType | undefined;

  const client = new EzCapSolverClient({
    clientKey: "k",
    polling: { interval: 1, maxAttempts: 3 },
    fetch: (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { task?: Record<string, unknown> };
      if (body.task) {
        sent.push(body.task);
        pending = body.task["type"] as KnownTaskType;
      }
      return new Response(
        JSON.stringify({
          errorId: 0,
          taskId: "t-1",
          status: "ready",
          solution: (pending && SOLUTIONS[pending]) ?? {},
        }),
        { status: 200 },
      );
    }) as unknown as typeof globalThis.fetch,
  });
  return { client, sent };
}

type Shortcuts = Record<string, (params: unknown) => Promise<unknown>>;

describe("every named method", () => {
  it.each(KNOWN_TASK_TYPES)("solve%s sends exactly that type", async (type) => {
    const { client, sent } = recordingClient();
    await (client as unknown as Shortcuts)[`solve${type}`]?.(PARAMS[type]);
    expect(sent[0]?.["type"]).toBe(type);
  });

  it.each(KNOWN_TASK_TYPES)("syncSolve%s sends exactly that type", async (type) => {
    const { client, sent } = recordingClient();
    await (client as unknown as Shortcuts)[`syncSolve${type}`]?.(PARAMS[type]);
    expect(sent[0]?.["type"]).toBe(type);
  });

  it("routes the two endpoints to their own hosts", async () => {
    const urls: string[] = [];
    const client = new EzCapSolverClient({
      clientKey: "k",
      polling: { interval: 1, maxAttempts: 3 },
      fetch: (async (url: string) => {
        urls.push(String(url));
        return new Response(
          JSON.stringify({
            errorId: 0,
            taskId: "t",
            status: "ready",
            solution: { gRecaptchaResponse: "x" },
          }),
          { status: 200 },
        );
      }) as unknown as typeof globalThis.fetch,
    });

    await client.solveReCaptchaV2TaskProxyless({ websiteURL: "u", websiteKey: "k" });
    await client.syncSolveReCaptchaV2TaskProxyless({ websiteURL: "u", websiteKey: "k" });

    // The service splits its two deployments; they cannot share one host.
    expect(urls[0]).toBe("https://api.ez-captcha.com/createTask");
    expect(urls.at(-1)).toBe("https://sync.ez-captcha.com/createSyncTask");
  });
});
