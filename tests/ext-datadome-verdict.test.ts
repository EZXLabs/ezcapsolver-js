import { describe, expect, it } from "vitest";

import {
  DEFAULT_GET_DELAY_MS,
  readVerdict,
  submissionFrom,
  submitDelayMs,
} from "../src/ext/datadome/verdict.js";
import { type DataDomeError, isDataDomeError } from "../src/ext/errors.js";

/** Calls a function that should throw a DataDomeError, and returns it. */
function dataDomeErrorOf(fn: () => unknown): DataDomeError {
  try {
    fn();
  } catch (error) {
    if (isDataDomeError(error)) return error;
    throw error;
  }
  throw new Error("expected a DataDomeError");
}

describe("the submission", () => {
  it("is a GET for a slider answer or one without a body", () => {
    expect(submissionFrom({ url: "https://dd/check", kind: "slider", body: "x=1" })).toEqual({
      url: "https://dd/check",
    });
    expect(submissionFrom({ url: "https://dd/check", body: "" })).toEqual({
      url: "https://dd/check",
    });
    expect(submissionFrom({ url: "https://dd/i", kind: "interstitial", body: "x=1" })).toEqual({
      url: "https://dd/i",
      body: "x=1",
    });
    expect(dataDomeErrorOf(() => submissionFrom({})).blocked).toBe(false);
  });

  it("waits as long as the answer asks, with a default for a GET", () => {
    expect(submitDelayMs({ submit_after_ms: 1500 }, { url: "u" })).toBe(1500);
    expect(submitDelayMs({ submit_after_ms: 0 }, { url: "u" })).toBe(DEFAULT_GET_DELAY_MS);
    expect(submitDelayMs({}, { url: "u", body: "x=1" })).toBe(0);
  });
});

describe("the verdict", () => {
  const target = new URL("https://shop.example.com/signup");

  it("splits the cookie into its parts", () => {
    const raw = "datadome=abc123; Max-Age=31536000; Domain=.example.com; Path=/; Secure";
    expect(readVerdict(JSON.stringify({ view: "redirect", cookie: raw }), target)).toEqual({
      name: "datadome",
      value: "abc123",
      domain: ".example.com",
      raw,
    });
    expect(readVerdict('{"cookie":"datadome=v; Path=/"}', target).domain).toBe(".example.com");
  });

  it("says why a response brought back no cookie", () => {
    const banned =
      '{"view":"captcha","url":"https://geo.captcha-delivery.com/captcha/?t=bv&cid=x"}';
    expect(dataDomeErrorOf(() => readVerdict(banned, target)).blocked).toBe(true);

    const rejected = '{"view":"captcha","url":"https://geo.captcha-delivery.com/captcha/?t=fe"}';
    expect(dataDomeErrorOf(() => readVerdict(rejected, target)).blocked).toBe(false);

    expect(dataDomeErrorOf(() => readVerdict("<html>oops</html>", target)).message).toContain(
      "not JSON",
    );
  });
});
