import { describe, expect, it } from "vitest";

import {
  ApiError,
  configError,
  EzCaptchaError,
  isApiError,
  isDecodeError,
  isEzCaptchaError,
  isPollingExhaustedError,
  isTransportError,
  isWaitInterruptedError,
  PollingExhaustedError,
  SolutionDecodeError,
  TransportError,
  taskIdOf,
  UnexpectedResponseError,
  WaitInterruptedError,
} from "../src/errors.js";

describe("recognising an error from this SDK", () => {
  it("survives the package being loaded twice", () => {
    // A dual-format package can be loaded twice in one process, once as ESM and
    // once as CJS, producing two unrelated class objects — and instanceof then
    // answers false for an error that genuinely came from this SDK. What follows
    // simulates an error built by that other copy.
    const fromAnotherCopy = Object.assign(new Error("boom"), {
      [Symbol.for("ezcapsolver.error")]: true,
      kind: "api" as const,
    });

    expect(fromAnotherCopy instanceof EzCaptchaError).toBe(false);
    expect(isEzCaptchaError(fromAnotherCopy)).toBe(true);
    expect(isApiError(fromAnotherCopy)).toBe(true);
  });

  it("says no to anything else", () => {
    for (const value of [null, undefined, "string", 42, {}, new Error("plain")]) {
      expect(isEzCaptchaError(value)).toBe(false);
    }
  });

  it("sorts each error into exactly one layer", () => {
    const transport = new TransportError("POST /x", { cause: new Error("down") });
    const api = new ApiError({ errorCode: "E", errorDescription: "d", httpStatus: 500 });
    const exhausted = new PollingExhaustedError("t", 5, 3_000);
    const unexpected = new UnexpectedResponseError("nope");
    const decode = new SolutionDecodeError("{}", "bad");
    const interrupted = new WaitInterruptedError("t", "r", api);

    expect([
      isTransportError(transport),
      isApiError(api),
      isPollingExhaustedError(exhausted),
      isDecodeError(unexpected),
      isDecodeError(decode),
      isWaitInterruptedError(interrupted),
    ]).toEqual([true, true, true, true, true, true]);

    // Mutually exclusive: no error belongs to two layers at once.
    expect(isApiError(transport)).toBe(false);
    expect(isTransportError(api)).toBe(false);
    expect(isDecodeError(exhausted)).toBe(false);
  });

  it("names itself after its own class, so a log line says which it was", () => {
    expect(new PollingExhaustedError("t", 1, 1).name).toBe("PollingExhaustedError");
    expect(configError("bad").name).toBe("EzCaptchaError");
  });
});

describe("recovering a billed task", () => {
  it("finds the id whichever error type is carrying it", () => {
    expect(taskIdOf(new WaitInterruptedError("w-1", undefined, new Error("x")))).toBe("w-1");
    expect(taskIdOf(new PollingExhaustedError("p-1", 5, 3_000))).toBe("p-1");
    expect(
      taskIdOf(
        new ApiError({ errorCode: "E", errorDescription: "d", httpStatus: 500, taskId: "a-1" }),
      ),
    ).toBe("a-1");
  });

  it("digs through the cause chain to reach it", () => {
    const buried = new Error("outer", {
      cause: new Error("middle", { cause: new PollingExhaustedError("deep-1", 5, 3_000) }),
    });
    expect(taskIdOf(buried)).toBe("deep-1");
  });

  it("returns nothing when nothing was billed", () => {
    // Failing before or during task creation means nothing was billed, and so
    // there is nothing to recover.
    expect(taskIdOf(new TransportError("POST /createTask", { cause: new Error("dns") }))).toBe(
      undefined,
    );
    expect(taskIdOf(configError("bad key"))).toBe(undefined);
    expect(taskIdOf(new ApiError({ errorCode: "E", errorDescription: "d", httpStatus: 401 }))).toBe(
      undefined,
    );
    expect(taskIdOf(undefined)).toBe(undefined);
    expect(taskIdOf("not an error")).toBe(undefined);
  });

  it("does not loop forever on a cycle", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    (a as { cause?: unknown }).cause = b;
    expect(taskIdOf(a)).toBe(undefined);
  });
});

describe("a wait that was interrupted", () => {
  it("keeps the underlying failure reachable and classifiable", () => {
    const underlying = new TransportError("POST /getTaskResult", { cause: new Error("reset") });
    const wrapped = new WaitInterruptedError("task-9", "req-9", underlying);

    expect(wrapped.taskId).toBe("task-9");
    expect(wrapped.requestId).toBe("req-9");
    // Wrapped, not replaced: the original classification is still reachable.
    expect(wrapped.cause).toBe(underlying);
    expect(isTransportError(wrapped.cause)).toBe(true);
    expect(wrapped.message).toContain("was created but waiting for its result failed");
  });
});

describe("what an error says", () => {
  it("puts everything actionable on one line", () => {
    const error = new ApiError({
      errorCode: "ERROR_REQUEST_PARAMETERS",
      errorDescription: "validation failed",
      httpStatus: 400,
      errors: { b: "second", a: "first" },
    });
    expect(error.message).toBe(
      "ERROR_REQUEST_PARAMETERS: validation failed (HTTP 400); a: first, b: second",
    );
  });

  it("treats an unknown code as possibly transient, not as terminal", () => {
    // A code this release has not seen may well be transient. Calling it
    // terminal would talk a caller out of a retry that would have worked.
    const unknown = new ApiError({
      errorCode: "ERROR_FROM_THE_FUTURE",
      errorDescription: "",
      httpStatus: 500,
    });
    expect(unknown.isTerminal()).toBe(false);
    expect(unknown.isAuthenticationError()).toBe(false);
  });

  it("flags the three codes that earn a ban", () => {
    for (const code of [
      "ERROR_KEY_DOES_NOT_EXIST",
      "ERROR_KEY_NOT_AVAILABLE",
      "ERROR_ZERO_BALANCE",
    ]) {
      const error = new ApiError({ errorCode: code, errorDescription: "", httpStatus: 401 });
      expect(error.isAuthenticationError()).toBe(true);
      // These three are terminal as well: the same request fails the same way.
      expect(error.isTerminal()).toBe(true);
    }
  });

  it("counts only the two throttling codes as rate limits", () => {
    // waitForResult retries exactly this set, so it has to stay narrower than
    // "everything that is not terminal". A code leaking in would make the loop
    // poll on past a task that has genuinely failed.
    for (const code of ["ERROR_REQUEST_LIMIT", "ERROR_REQUEST_BANNED"]) {
      const error = new ApiError({ errorCode: code, errorDescription: "", httpStatus: 429 });
      expect(error.isRateLimited()).toBe(true);
      expect(error.isTerminal()).toBe(false);
    }
    for (const code of [
      "ERROR_SERVICE_UNAVAILABLE",
      "ERROR_SERVICE_TIMEOUT",
      "ERROR_INTERNAL_SERVER_ERROR",
      "ERROR_TASK_NOT_EXIST",
      "ERROR_ZERO_BALANCE",
      "ERROR_FROM_THE_FUTURE",
      "",
    ]) {
      const error = new ApiError({ errorCode: code, errorDescription: "", httpStatus: 500 });
      expect(error.isRateLimited()).toBe(false);
    }
  });

  it("truncates a huge raw solution on a character boundary", () => {
    // Cut on code points, so a surrogate pair is never split into mojibake.
    const raw = "🙂".repeat(1_000);
    const error = new SolutionDecodeError(raw, "unusable");
    expect(error.raw).toBe(raw);
    expect(error.message).toContain("...");
    expect([...error.message].every((c) => c !== "�")).toBe(true);
  });

  it("keeps a short body inline and drops an absent one", () => {
    expect(new UnexpectedResponseError("bad", '{"a":1}').message).toContain('body: {"a":1}');
    expect(new UnexpectedResponseError("bad").message).toBe("unexpected API response: bad");
  });

  it("says how long a wait lasted before it gave up", () => {
    const error = new PollingExhaustedError("t-1", 50, 3_000);
    expect(error.message).toContain("50 polling attempts at 3000ms intervals");
    expect(error.attempts).toBe(50);
    expect(error.interval).toBe(3_000);
  });

  it("marks a configuration failure as one, so it reads as a code fix", () => {
    const error = configError("timeout must be greater than zero");
    expect(error.kind).toBe("config");
    expect(error.message).toBe("invalid client configuration: timeout must be greater than zero");
  });
});
