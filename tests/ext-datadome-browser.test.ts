import { describe, expect, it } from "vitest";

import {
  BrowserProfile,
  CHALLENGE_ORIGIN,
  chromeMajor,
  FORM_CONTENT_TYPE,
  type Headers,
} from "../src/ext/datadome/browser.js";
import { isDataDomeError } from "../src/ext/errors.js";

const WINDOWS_CHROME_153 =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

/** Looks a header up by name. */
function header(headers: Headers, name: string): string | undefined {
  return headers.find(([key]) => key === name)?.[1];
}

/** Calls a function that should throw, and returns what it threw. */
function catchOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
}

describe("the browser identity", () => {
  it("takes the Chrome version from the user agent", () => {
    expect(chromeMajor(WINDOWS_CHROME_153)).toBe(153);
    expect(chromeMajor("Chrome/99")).toBe(99);
    expect(chromeMajor("Mozilla/5.0 Firefox/133.0")).toBeUndefined();
    expect(chromeMajor("Chrome/x")).toBeUndefined();
  });

  it("accepts only the versions with a TLS fingerprint preset", () => {
    for (const [version, preset] of [
      ["131", "chrome_131"],
      ["144", "chrome_144"],
      ["153", "chrome_153"],
      ["158", "chrome_158"],
    ]) {
      expect(new BrowserProfile(`Chrome/${version}.0.0.0`, "en").tlsPreset()).toBe(preset);
    }
    for (const version of ["120", "143", "159"]) {
      const profile = new BrowserProfile(`Chrome/${version}.0.0.0`, "en");
      expect(isDataDomeError(catchOf(() => profile.tlsPreset()))).toBe(true);
    }
    expect(isDataDomeError(catchOf(() => new BrowserProfile("Firefox/133.0", "en")))).toBe(true);
  });

  it("derives the client hints from the user agent", () => {
    const headers = new BrowserProfile(WINDOWS_CHROME_153, "en-US,en;q=0.9").navigation();
    expect(header(headers, "sec-ch-ua")).toBe(
      '"Chromium";v="153", "Google Chrome";v="153", "Not/A)Brand";v="99"',
    );
    expect(header(headers, "sec-ch-ua-platform")).toBe('"Windows"');
    expect(header(headers, "user-agent")).toBe(WINDOWS_CHROME_153);
    expect(header(headers, "accept-language")).toBe("en-US,en;q=0.9");

    const mac = new BrowserProfile(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/153.0.0.0",
      "en",
    );
    expect(header(mac.navigation(), "sec-ch-ua-platform")).toBe('"macOS"');
  });
});

describe("the referer of each request", () => {
  it("is what a browser would send", () => {
    const profile = new BrowserProfile(WINDOWS_CHROME_153, "en");
    const target = new URL("https://shop.example.com/signup?next=1");
    const challenge = new URL("https://geo.captcha-delivery.com/captcha/?initialCid=x");

    expect(header(profile.challengeFrame(target, true), "referer")).toBe(
      "https://shop.example.com/signup?next=1",
    );
    expect(header(profile.challengeFrame(target, false), "referer")).toBe(
      "https://shop.example.com",
    );
    expect(header(profile.script(challenge), "referer")).toBe("https://geo.captcha-delivery.com/");
    expect(header(profile.submission(challenge, false), "referer")).toBe(challenge.href);
  });

  it("gives only a POST submission a form content type and an origin", () => {
    const profile = new BrowserProfile(WINDOWS_CHROME_153, "en");
    const challenge = new URL("https://geo.captcha-delivery.com/interstitial/?x=1");

    const post = profile.submission(challenge, true);
    expect(header(post, "content-type")).toBe(FORM_CONTENT_TYPE);
    expect(header(post, "origin")).toBe(CHALLENGE_ORIGIN);

    const get = profile.submission(challenge, false);
    expect(header(get, "content-type")).toBeUndefined();
    expect(header(get, "origin")).toBeUndefined();
  });
});
