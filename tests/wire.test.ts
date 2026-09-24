import { describe, expect, it } from "vitest";

import { isApiError, UnexpectedResponseError } from "../src/errors.js";
import { balanceBody, createTaskBody, endpoint, parseEnvelope } from "../src/wire.js";

describe("parsing the envelope", () => {
  it("fails a 200 whose envelope says errorId 1", () => {
    // A failed task arrives with HTTP 200, so the status cannot save it: the
    // criterion is errorId.
    const error = catchOf(() =>
      parseEnvelope(200, JSON.stringify({ errorId: 1, errorCode: "ERROR_TASK_NOT_EXIST" })),
    );
    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("unreachable");
    expect(error.errorCode).toBe("ERROR_TASK_NOT_EXIST");
    expect(error.httpStatus).toBe(200);
  });

  it("prefers the envelope's code over the status when both say failure", () => {
    // Most business errors arrive with HTTP 500. Checking errorId first is what
    // hands the caller a code they can branch on, rather than a generic "the
    // server returned 500".
    const error = catchOf(() =>
      parseEnvelope(
        500,
        JSON.stringify({ errorId: 1, errorCode: "ERROR_ZERO_BALANCE", errorDescription: "empty" }),
      ),
    );
    if (!isApiError(error)) throw new Error("unreachable");
    expect(error.errorCode).toBe("ERROR_ZERO_BALANCE");
    expect(error.httpStatus).toBe(500);
    expect(error.isAuthenticationError()).toBe(true);
  });

  it("accepts a 2xx whose envelope says errorId 0", () => {
    const envelope = parseEnvelope(200, JSON.stringify({ errorId: 0, balance: 1 }));
    expect(envelope["balance"]).toBe(1);
  });

  it("does not take a non-empty errorCode as a second failure signal", () => {
    // Treating errorCode as a signal would reject a solved task if success codes
    // are added later.
    const envelope = parseEnvelope(
      200,
      JSON.stringify({ errorId: 0, errorCode: "SOME_FUTURE_SUCCESS_CODE", taskId: "t" }),
    );
    expect(envelope["taskId"]).toBe("t");
  });

  it("carries field-level validation errors through", () => {
    const error = catchOf(() =>
      parseEnvelope(
        400,
        JSON.stringify({
          errorId: 1,
          errorCode: "ERROR_REQUEST_PARAMETERS",
          errorDescription: "bad request",
          errors: { "task.websiteURL": "must not be blank", "task.websiteKey": "required" },
          requestId: "req-7",
        }),
      ),
    );
    if (!isApiError(error)) throw new Error("unreachable");
    expect(error.requestId).toBe("req-7");
    expect(error.errors).toEqual({
      "task.websiteURL": "must not be blank",
      "task.websiteKey": "required",
    });
    // Fields are sorted by name, so one set of errors renders identically every
    // time and two log lines stay comparable.
    expect(error.message).toContain(
      "task.websiteKey: required, task.websiteURL: must not be blank",
    );
  });

  it("reports an unparsable failure body as a server error, not a decode failure", () => {
    // Not 2xx and not JSON — still a server error. Reporting it in the envelope's
    // shape is what keeps the status readable from one place.
    const error = catchOf(() => parseEnvelope(502, "<html>Bad Gateway</html>"));
    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("unreachable");
    expect(error.httpStatus).toBe(502);
    expect(error.errorDescription).toContain("Bad Gateway");
  });

  it("reports an unparsable success body as a broken contract", () => {
    const error = catchOf(() => parseEnvelope(200, "not json at all"));
    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(String(error)).toContain("not valid JSON");
  });

  it("rejects a success body that parses but is not an object", () => {
    for (const body of ["[1,2,3]", '"a string"', "42", "null", ""]) {
      const error = catchOf(() => parseEnvelope(200, body));
      expect(error).toBeInstanceOf(UnexpectedResponseError);
      expect(String(error)).toContain("expected a JSON object");
    }
  });

  it("reports a non-2xx status that carried a valid but useless body", () => {
    const error = catchOf(() => parseEnvelope(503, JSON.stringify({ errorId: 0 })));
    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("unreachable");
    expect(error.httpStatus).toBe(503);
  });

  it("truncates an oversized body rather than burying the message", () => {
    const error = catchOf(() => parseEnvelope(500, "x".repeat(5_000)));
    if (!isApiError(error)) throw new Error("unreachable");
    expect(error.errorDescription.length).toBeLessThan(600);
    expect(error.errorDescription).toMatch(/\.\.\.$/);
  });

  it("names an error with no code at all rather than rendering a blank", () => {
    const error = catchOf(() => parseEnvelope(200, JSON.stringify({ errorId: 1 })));
    expect(String(error)).toContain("UNKNOWN_API_ERROR");
    expect(String(error)).toContain("unspecified error");
  });
});

describe("building a request", () => {
  it("joins a base URL and a path whatever slashes they carry", () => {
    for (const base of ["https://api.example.com", "https://api.example.com/"]) {
      for (const path of ["/createTask", "createTask"]) {
        expect(endpoint(base, path)).toBe("https://api.example.com/createTask");
      }
    }
  });

  it("puts the task type inside the task object, where the service wants it", () => {
    const body = createTaskBody("key", "ReCaptchaV2TaskProxyless", { websiteURL: "u" });
    expect(body).toEqual({
      clientKey: "key",
      task: { websiteURL: "u", type: "ReCaptchaV2TaskProxyless" },
    });
  });

  it("lets nothing in the parameters override the task type", () => {
    // A type mixed into the parameters must not change what is billed: the
    // caller decodes the result as the type they asked for.
    const body = createTaskBody("key", "HCaptcha", { type: "SomethingElse", websiteKey: "k" });
    expect(body.task.type).toBe("HCaptcha");
  });

  it("omits appId entirely when it is unset, which is not the same as zero", () => {
    expect("appId" in createTaskBody("key", "HCaptcha", {})).toBe(false);
    expect(createTaskBody("key", "HCaptcha", {}, 0).appId).toBe(0);
  });

  it("sends nothing but the key on a balance query", () => {
    expect(balanceBody("key")).toEqual({ clientKey: "key" });
  });
});

/** Runs `fn` and returns whatever it threw. */
function catchOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}
