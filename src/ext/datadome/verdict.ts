/**
 * Handing the step-three answer to DataDome, and reading the cookie it answers
 * with.
 *
 * @module
 */

import type { DataDomeSolution } from "../../solutions.js";
import { DataDomeError } from "../errors.js";
import type { DataDomeCookie } from "./types.js";

/** How long a GET submission waits when the answer names no delay. */
export const DEFAULT_GET_DELAY_MS = 20_000;
/** Challenge kind whose answer always goes out as a GET. */
const SLIDER_KIND = "slider";
/** `view` of a submission response that shows the captcha again. */
const CAPTCHA_VIEW = "captcha";
/** Query value of `t` that marks a banned visitor. */
const BANNED_MARKER = "bv";
/** How much of an unreadable response an error message quotes. */
const PREVIEW_CHARS = 200;

/**
 * The request that hands the step-three answer to DataDome: a form POST when
 * it has a body, a GET otherwise.
 */
export interface Submission {
  url: string;
  body?: string | undefined;
}

/**
 * Reads the submission out of a step-three answer. A slider answer, or one
 * without a body, goes out as a GET; any other is posted.
 */
export function submissionFrom(answer: DataDomeSolution): Submission {
  if (!answer.url) throw new DataDomeError("step 3 returned no submission url");
  if (answer.kind?.includes(SLIDER_KIND) || !answer.body) return { url: answer.url };
  return { url: answer.url, body: answer.body };
}

/**
 * How long to wait, counted from when the challenge page loaded, before
 * submitting.
 *
 * The answer's `submit_after_ms` decides; when it is absent or zero, a GET
 * waits {@link DEFAULT_GET_DELAY_MS} and a POST goes out at once.
 */
export function submitDelayMs(answer: DataDomeSolution, submission: Submission): number {
  const millis = answer.submit_after_ms;
  if (typeof millis === "number" && millis > 0) return millis;
  return submission.body === undefined ? DEFAULT_GET_DELAY_MS : 0;
}

/**
 * Reads DataDome's response to a submission and returns the cookie it issued.
 *
 * A response without a cookie is a failed run: a ban when DataDome shows the
 * captcha again with `t=bv`, a rejected answer otherwise.
 */
export function readVerdict(body: string, target: URL): DataDomeCookie {
  let verdict: unknown;
  try {
    verdict = JSON.parse(body);
  } catch {
    throw new DataDomeError(`the submission response is not JSON: ${body.slice(0, PREVIEW_CHARS)}`);
  }
  const cookie = textField(verdict, "cookie");
  if (cookie === "") throw rejection(verdict);
  return parseCookie(cookie, target);
}

/** Explains why a submission brought back no cookie. */
function rejection(verdict: unknown): DataDomeError {
  const view = textField(verdict, "view");
  if (view === CAPTCHA_VIEW && queryValue(textField(verdict, "url"), "t") === BANNED_MARKER) {
    return new DataDomeError("the submission was answered with a ban (t=bv)", { blocked: true });
  }
  return new DataDomeError(`the challenge was not passed (view "${view}")`);
}

/**
 * Splits DataDome's cookie string into its parts.
 *
 * The domain falls back to the last two labels of the target host when the
 * cookie carries no `Domain` attribute.
 */
function parseCookie(raw: string, target: URL): DataDomeCookie {
  const [pair = "", ...attributes] = raw.split(";");
  const separator = pair.indexOf("=");
  const name = separator < 0 ? pair : pair.slice(0, separator);
  const value = separator < 0 ? "" : pair.slice(separator + 1);
  return {
    name: name.trim(),
    value: value.trim(),
    domain: cookieDomain(attributes, target),
    raw,
  };
}

/** The first `Domain` attribute, or the fallback built from the target host. */
function cookieDomain(attributes: string[], target: URL): string {
  for (const attribute of attributes) {
    const trimmed = attribute.trim();
    for (const prefix of ["Domain=", "domain="]) {
      if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length).trim();
    }
  }
  return `.${target.hostname.split(".").slice(-2).join(".")}`;
}

/** A string field of the verdict, empty when absent or not a string. */
function textField(verdict: unknown, name: string): string {
  if (typeof verdict !== "object" || verdict === null) return "";
  const value = (verdict as Record<string, unknown>)[name];
  return typeof value === "string" ? value : "";
}

/** First value of a query parameter, for an absolute or a relative address. */
function queryValue(address: string, name: string): string | null {
  const start = address.indexOf("?");
  if (start < 0) return null;
  const query = address.slice(start + 1).split("#")[0];
  return new URLSearchParams(query).get(name);
}
