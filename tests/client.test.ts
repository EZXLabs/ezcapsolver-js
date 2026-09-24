import { describe, expect, it } from "vitest";

import { EzCapSolverClient } from "../src/client.js";
import {
  isApiError,
  isDecodeError,
  isPollingExhaustedError,
  isWaitInterruptedError,
  taskIdOf,
} from "../src/errors.js";
import { KNOWN_TASK_TYPES } from "../src/task-type.js";

/** One recorded request, as the fake transport saw it. */
interface Recorded {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * A fetch that replays canned envelopes and records what it was asked to send.
 *
 * This is the whole test double. Go needs an `httptest.Server` and Python needs
 * `respx` because neither can hand the client a function; here the injection
 * point is the seam.
 */
function fakeFetch(replies: unknown[]): {
  fetch: typeof globalThis.fetch;
  sent: Recorded[];
} {
  const sent: Recorded[] = [];
  const queue = [...replies];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    const reply = queue.shift() ?? { errorId: 0 };
    const status =
      typeof reply === "object" && reply !== null && "__status" in reply
        ? (reply as { __status: number }).__status
        : 200;
    return new Response(JSON.stringify(reply), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, sent };
}

/** A client that never touches the network and never waits. */
function testClient(replies: unknown[]) {
  const { fetch, sent } = fakeFetch(replies);
  const client = new EzCapSolverClient({
    clientKey: "test-key",
    fetch,
    polling: { interval: 1, maxAttempts: 5 },
  });
  return { client, sent };
}

describe("solve", () => {
  it("creates a task, polls it, and returns the worker's fields", async () => {
    const { client, sent } = testClient([
      { errorId: 0, taskId: "task-1", requestId: "req-1" },
      { errorId: 0, status: "processing" },
      {
        errorId: 0,
        status: "ready",
        solution: { gRecaptchaResponse: "03AGdBq2...", user_agent: "Mozilla/5.0" },
      },
    ]);

    const solved = await client.solve({
      type: "ReCaptchaV2TaskProxyless",
      websiteURL: "https://example.com",
      websiteKey: "6Lc-key",
    });

    expect(solved.solution.gRecaptchaResponse).toBe("03AGdBq2...");
    expect(solved.solution.user_agent).toBe("Mozilla/5.0");
    expect(solved.taskId).toBe("task-1");
    expect(sent).toHaveLength(3);
    expect(sent[0]?.url).toBe("https://api.ez-captcha.com/createTask");
    expect(sent[1]?.url).toBe("https://api.ez-captcha.com/getTaskResult");
  });

  it("keeps a field the worker added that this release does not declare", async () => {
    const { client } = testClient([
      { errorId: 0, taskId: "task-1" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok", brandNew: 42 } },
    ]);

    const solved = await client.solve({
      type: "ReCaptchaV2TaskProxyless",
      websiteURL: "https://example.com",
      websiteKey: "k",
    });

    // No extra bucket: an unmodelled field is on the object, read with a bracket.
    expect(solved.solution["brandNew"]).toBe(42);
    expect(solved.raw).toEqual({ gRecaptchaResponse: "tok", brandNew: 42 });
  });
});

describe("the request body", () => {
  it("puts the task type inside the task object and lets nothing override it", async () => {
    const { client, sent } = testClient([
      { errorId: 0, taskId: "t" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
    ]);

    await client.solve({
      type: "ReCaptchaV2TaskProxyless",
      websiteURL: "https://example.com",
      websiteKey: "k",
      // Slipping a type into the pass-through data must not change what is billed.
      extra: { type: "SomethingElse", customParam: "kept" },
    });

    const task = sent[0]?.body["task"] as Record<string, unknown>;
    expect(task["type"]).toBe("ReCaptchaV2TaskProxyless");
    expect(task["customParam"]).toBe("kept");
    expect(sent[0]?.body["clientKey"]).toBe("test-key");
  });

  it("supplies the values the service validates against a closed set", async () => {
    const { client, sent } = testClient([{ errorId: 0, status: "ready", solution: { kind: "s" } }]);

    await client.syncSolve({ type: "DataDomeTagsTaskProxyless", ddk: "k", referer: "r", ua: "u" });

    const task = sent[0]?.body["task"] as Record<string, unknown>;
    expect(task).toMatchObject({ jstype: "ch", cid: "", bpc: 1, fields: {} });
  });

  it("omits an optional the caller left out, so the service applies its own default", async () => {
    const { client, sent } = testClient([
      { errorId: 0, taskId: "t" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
    ]);

    await client.solve({
      type: "ReCaptchaV3TaskProxyless",
      websiteURL: "https://example.com",
      websiteKey: "k",
    });

    const task = sent[0]?.body["task"] as Record<string, unknown>;
    expect("isInvisible" in task).toBe(false);
  });

  it("sends the client key header on every endpoint, and no correlation id of its own", async () => {
    const { client, sent } = testClient([
      { errorId: 0, taskId: "t-1" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
      { errorId: 0, balance: 1 },
    ]);
    const task = {
      type: "ReCaptchaV2TaskProxyless",
      websiteURL: "https://example.com",
      websiteKey: "k",
    } as const;

    await client.solve(task);
    await client.syncSolve(task);
    await client.getBalance();

    expect(sent.map((request) => new URL(request.url).pathname)).toEqual([
      "/createTask",
      "/getTaskResult",
      "/createSyncTask",
      "/getBalance",
    ]);
    for (const request of sent) {
      expect(request.headers["X-API-Key"]).toBe("test-key");
      // The gateway assigns the request id; the SDK only reads it back. One sent
      // from here would compete with the id the platform is already tracing on.
      expect(request.headers).not.toHaveProperty("X-Request-Id");
    }
  });
});

describe("failures", () => {
  it("reports a business error from errorId, not from the HTTP status", async () => {
    const { client } = testClient([
      { errorId: 1, errorCode: "ERROR_ZERO_BALANCE", errorDescription: "no funds" },
    ]);

    const error = await client
      .solve({ type: "ReCaptchaV2TaskProxyless", websiteURL: "u", websiteKey: "k" })
      .catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("unreachable");
    expect(error.errorCode).toBe("ERROR_ZERO_BALANCE");
    expect(error.httpStatus).toBe(200);
    expect(error.isAuthenticationError()).toBe(true);
    expect(error.isTerminal()).toBe(true);
  });

  it("carries the billed task's id out of a failure that lost it", async () => {
    const { client } = testClient([
      { errorId: 0, taskId: "billed-task", requestId: "req-9" },
      { errorId: 0, status: "ready" }, // ready with no solution: a broken contract
    ]);

    const error = await client
      .solve({ type: "ReCaptchaV2TaskProxyless", websiteURL: "u", websiteKey: "k" })
      .catch((e: unknown) => e);

    expect(isWaitInterruptedError(error)).toBe(true);
    // This is the point: the task was billed, so the id has to come back out or
    // the money is gone.
    expect(taskIdOf(error)).toBe("billed-task");
    if (!isWaitInterruptedError(error)) throw new Error("unreachable");
    expect(error.requestId).toBe("req-9");
  });

  it("gives an exhausted budget back untouched, since it already carries the id", async () => {
    const { client } = testClient([
      { errorId: 0, taskId: "slow-task" },
      ...Array.from({ length: 5 }, () => ({ errorId: 0, status: "processing" })),
    ]);

    const error = await client
      .solve({ type: "ReCaptchaV2TaskProxyless", websiteURL: "u", websiteKey: "k" })
      .catch((e: unknown) => e);

    // Not wrapped again — that would only make a caller peel one more layer off
    // to reach the same id.
    expect(isWaitInterruptedError(error)).toBe(false);
    expect(taskIdOf(error)).toBe("slow-task");
  });

  it("refuses a configuration it cannot use, before anything is billed", () => {
    expect(() => new EzCapSolverClient({ clientKey: "" })).toThrow(/client key must not be blank/);
    expect(() => new EzCapSolverClient({ clientKey: "k", timeout: 0 })).toThrow(
      /timeout must be greater than zero/,
    );
    expect(() => new EzCapSolverClient({ clientKey: "k", asyncBaseUrl: "ftp://x" })).toThrow(
      /must use http or https/,
    );
  });
});

describe("logging", () => {
  it("never lets a credential reach the log sink", async () => {
    const records: { fields: Record<string, unknown>; message: string }[] = [];
    const { fetch } = fakeFetch([{ errorId: 0, balance: 1 }]);
    const client = new EzCapSolverClient({
      clientKey: "super-secret-key",
      fetch,
      logger: { trace: (fields, message) => records.push({ fields, message }) },
    });

    await client.getBalance();

    const rendered = JSON.stringify(records);
    expect(rendered).not.toContain("super-secret-key");
    expect(rendered).toContain("[REDACTED]");
  });

  it("redacts a proxy nested inside the task object", async () => {
    const records: Record<string, unknown>[] = [];
    const { fetch } = fakeFetch([{ errorId: 0, status: "ready", solution: { data: "d" } }]);
    const client = new EzCapSolverClient({
      clientKey: "k",
      fetch,
      logger: { trace: (fields) => records.push(fields) },
    });

    await client.syncSolve({
      type: "IncapsulaTaskProxyless",
      script: "s",
      scriptUrl: "u",
      pageUrl: "p",
      acceptLanguage: "en",
      ua: "ua",
      proxy: "http://user:pass@proxy.example:8080",
    });

    const rendered = JSON.stringify(records);
    expect(rendered).not.toContain("pass@proxy.example");
  });
});

describe("the configuration a client reports", () => {
  it("has no client key on it at all", () => {
    const client = new EzCapSolverClient({ clientKey: "secret" });
    expect(JSON.stringify(client.config)).not.toContain("secret");
    expect(client.config.timeout).toBe(30_000);
    expect(client.config.syncTimeout).toBe(240_000);
    expect(client.config.polling).toEqual({ interval: 3_000, maxAttempts: 50 });
  });
});

describe("the named shortcuts", () => {
  it("covers every task type, with the wire name spelled exactly", () => {
    // The rule the Go SDK guards with reflection: a method name is the wire type
    // with a prefix. A missing one, or a single wrong character, fails here.
    const missing = KNOWN_TASK_TYPES.flatMap((type) =>
      [`solve${type}`, `syncSolve${type}`].filter(
        (name) => typeof (EzCapSolverClient.prototype as never)[name] !== "function",
      ),
    );
    expect(missing).toEqual([]);
  });

  it("sends exactly what the generic form sends", async () => {
    const viaShortcut = testClient([
      { errorId: 0, taskId: "t" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
    ]);
    const viaGeneric = testClient([
      { errorId: 0, taskId: "t" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
    ]);

    const params = { websiteURL: "https://example.com", websiteKey: "k" };
    await viaShortcut.client.solveReCaptchaV2TaskProxyless(params);
    await viaGeneric.client.solve({ type: "ReCaptchaV2TaskProxyless", ...params });

    expect(viaShortcut.sent[0]?.body).toEqual(viaGeneric.sent[0]?.body);
  });

  it("infers the same solution the generic form does", async () => {
    const { client } = testClient([{ errorId: 0, status: "ready", solution: { token: "t0k" } }]);
    const solved = await client.syncSolveCloudFlareTurnstileTask({
      websiteURL: "https://example.com",
      websiteKey: "0x4",
    });
    // This line is the assertion: solution was inferred as CloudflareTurnstileSolution.
    const token: string = solved.solution.token;
    expect(token).toBe("t0k");
  });
});

describe("custom parameters on the named methods", () => {
  it("sends a parameter this release does not model, written inline", async () => {
    const { client, sent } = testClient([
      { errorId: 0, taskId: "t" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
    ]);

    await client.solveReCaptchaV2TaskProxyless({
      websiteURL: "https://example.com",
      websiteKey: "k",
      // Written at the same level, with no extra to nest under.
      someNewParam: 1,
      anotherOne: ["a", "b"],
    });

    const task = sent[0]?.body["task"] as Record<string, unknown>;
    expect(task["someNewParam"]).toBe(1);
    expect(task["anotherOne"]).toEqual(["a", "b"]);
    expect(task["websiteURL"]).toBe("https://example.com");
  });

  it("never lets an inline type change what gets billed", async () => {
    const { client, sent } = testClient([
      { errorId: 0, taskId: "t" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
    ]);

    await client.solveReCaptchaV2TaskProxyless({
      websiteURL: "https://example.com",
      websiteKey: "k",
      // Inline parameters are unrestricted now, so this one has to be blocked:
      // otherwise a caller decodes the result as V2 while another type was billed.
      type: "SomethingElse",
    });

    const task = sent[0]?.body["task"] as Record<string, unknown>;
    expect(task["type"]).toBe("ReCaptchaV2TaskProxyless");
  });

  it("still accepts an explicit extra, for callers who prefer it separate", async () => {
    const { client, sent } = testClient([
      { errorId: 0, taskId: "t" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } },
    ]);

    await client.solveReCaptchaV2TaskProxyless({
      websiteURL: "https://example.com",
      websiteKey: "k",
      extra: { viaExtra: true },
    });

    const task = sent[0]?.body["task"] as Record<string, unknown>;
    expect(task["viaExtra"]).toBe(true);
    expect("extra" in task).toBe(false);
  });
});

describe("responses that break the contract", () => {
  it("rejects a create-task response with no task id", async () => {
    const { client } = testClient([{ errorId: 0, requestId: "r" }]);
    const error = await client
      .createTask({ type: "HCaptcha", websiteURL: "u", websiteKey: "k" })
      .catch((e: unknown) => e);
    expect(isDecodeError(error)).toBe(true);
    expect(String(error)).toContain("does not contain a task ID");
  });

  it("returns the id from createTask so a caller can persist it before waiting", async () => {
    const { client, sent } = testClient([{ errorId: 0, taskId: "task-42" }]);
    await expect(
      client.createTask({ type: "HCaptcha", websiteURL: "u", websiteKey: "k" }),
    ).resolves.toBe("task-42");
    expect(sent).toHaveLength(1);
  });

  it("rejects a task response with no status field", async () => {
    const { client } = testClient([{ errorId: 0, taskId: "t" }]);
    const error = await client.getTaskResult("t").catch((e: unknown) => e);
    expect(String(error)).toContain("does not contain a status field");
  });

  it("rejects a status the service does not define", async () => {
    const { client } = testClient([{ errorId: 0, status: "almost-done" }]);
    const error = await client.getTaskResult("t").catch((e: unknown) => e);
    // An unknown status breaks the contract; it must not pass as "still processing".
    expect(String(error)).toContain('unknown task status "almost-done"');
  });

  it("rejects a ready result that carries no solution", async () => {
    const { client } = testClient([{ errorId: 0, status: "ready" }]);
    const error = await client.getTaskResult("t").catch((e: unknown) => e);
    expect(String(error)).toContain("does not contain a solution");
  });

  it("keeps a solution that is present but null, which is a finished empty answer", async () => {
    // An absent field means the task has not finished; a null one means the
    // worker finished and returned nothing.
    const { client } = testClient([{ errorId: 0, status: "ready", solution: null }]);
    const result = await client.getTaskResult("t");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("unreachable");
    expect(result.solution).toBe(null);
  });

  it("refuses to hand back a task that says error without an API error", async () => {
    const { client } = testClient([
      { errorId: 0, taskId: "t" },
      { errorId: 0, status: "error" },
    ]);
    const error = await client
      .solve({
        type: "HCaptcha",
        websiteURL: "u",
        websiteKey: "k",
        lang: "en-US",
        invisible: false,
      })
      .catch((e: unknown) => e);
    // A failed task arrives with errorId 1 and is already an ApiError, so
    // reaching here means the envelope contradicted itself.
    expect(String(error)).toContain('status "error" without an API error');
  });

  it("refuses to hand back a result that is still processing", async () => {
    const { client } = testClient([{ errorId: 0, status: "processing" }]);
    const error = await client
      .syncSolve({ type: "TlsTask", tls_type: "c", proxy: "p", url: "u" })
      .catch((e: unknown) => e);
    expect(String(error)).toContain("still processing without an API error");
  });

  it("rejects a balance that is missing or not a number", async () => {
    for (const envelope of [{ errorId: 0 }, { errorId: 0, balance: "1.5" }]) {
      const { client } = testClient([envelope]);
      const error = await client.getBalance().catch((e: unknown) => e);
      // Missing is not a zero balance — the two call for opposite reactions.
      expect(String(error)).toContain("does not contain a numeric balance");
    }
  });

  it("accepts a zero balance, which is a real answer", async () => {
    const { client } = testClient([{ errorId: 0, balance: 0 }]);
    await expect(client.getBalance()).resolves.toBe(0);
  });
});

describe("an API error raised while waiting", () => {
  it("gains the billed task's id, which the service does not echo back", async () => {
    const { client } = testClient([
      { errorId: 0, taskId: "billed-1" },
      { errorId: 1, errorCode: "ERROR_TASK_NOT_EXIST", errorDescription: "gone" },
    ]);

    const error = await client
      .solve({
        type: "HCaptcha",
        websiteURL: "u",
        websiteKey: "k",
        lang: "en-US",
        invisible: false,
      })
      .catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("unreachable");
    // Not wrapped — the id goes onto the ApiError itself, so an existing catch
    // does not start missing it.
    expect(isWaitInterruptedError(error)).toBe(false);
    expect(error.taskId).toBe("billed-1");
    expect(taskIdOf(error)).toBe("billed-1");
  });

  it("uses the id from creation, since the service never echoes one back", async () => {
    // The service's error envelope carries no taskId, and none of the four SDKs
    // reads one from it — the field is always backfilled with the id from
    // creation. One present in the envelope is not trusted.
    const { client } = testClient([
      { errorId: 0, taskId: "created-1" },
      { errorId: 1, errorCode: "E", errorDescription: "d", taskId: "ignored-by-design" },
    ]);
    const error = await client
      .solve({
        type: "HCaptcha",
        websiteURL: "u",
        websiteKey: "k",
        lang: "en-US",
        invisible: false,
      })
      .catch((e: unknown) => e);
    if (!isApiError(error)) throw new Error("unreachable");
    expect(error.taskId).toBe("created-1");
  });
});

describe("throttled polls", () => {
  /** A reCAPTCHA task, the shortest one to spell out. */
  const task = { type: "ReCaptchaV2TaskProxyless", websiteURL: "u", websiteKey: "k" } as const;
  const throttled = { __status: 429, errorId: 1, errorCode: "ERROR_REQUEST_LIMIT" };

  it("retries rather than failing the task", async () => {
    // A throttled query is refused before the service ever looks the task up,
    // so the task is still queued — and it has already been billed, which is
    // what makes giving up on it expensive.
    const { client, sent } = testClient([
      { errorId: 0, taskId: "task-9" },
      throttled,
      { __status: 429, errorId: 1, errorCode: "ERROR_REQUEST_BANNED" },
      { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "t" } },
    ]);

    const solved = await client.solve(task);

    expect(solved.taskId).toBe("task-9");
    expect(sent).toHaveLength(4);
  });

  it("still runs out the polling budget", async () => {
    // Retrying must not turn a five-attempt budget into an endless loop: the
    // result is held for only five minutes, so the wall clock the budget stands
    // for has to keep running.
    const { client, sent } = testClient([
      { errorId: 0, taskId: "task-9" },
      ...Array.from({ length: 5 }, () => throttled),
    ]);

    const error = await client.solve(task).catch((e: unknown) => e);

    expect(isPollingExhaustedError(error)).toBe(true);
    expect(taskIdOf(error)).toBe("task-9");
    expect(sent).toHaveLength(6);
  });

  it("ends the wait at once on any other API error", async () => {
    const { client, sent } = testClient([
      { errorId: 0, taskId: "task-9" },
      { __status: 500, errorId: 1, errorCode: "ERROR_INTERNAL_SERVER_ERROR" },
    ]);

    const error = await client.solve(task).catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    expect(sent).toHaveLength(2);
  });
});
