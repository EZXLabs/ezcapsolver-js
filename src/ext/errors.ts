/**
 * Failures of the workflows. An API call a workflow makes fails with the error
 * the client threw, so the core error guards still classify it.
 *
 * @module
 */

import { EzCaptchaError, isEzCaptchaError } from "../errors.js";

/**
 * A DataDome workflow that cannot go on: an unusable target URL, user agent or
 * proxy, a challenge without a script, or a submission DataDome did not accept.
 *
 * {@link DataDomeError.blocked} marks a visitor DataDome banned outright.
 */
export class DataDomeError extends EzCaptchaError {
  /**
   * Whether DataDome banned the visitor outright. No challenge clears that;
   * retry through a different proxy.
   */
  readonly blocked: boolean;

  constructor(message: string, options: { blocked?: boolean; cause?: unknown } = {}) {
    super(message, "datadome", { cause: options.cause });
    this.blocked = options.blocked ?? false;
  }
}

/** A request of a workflow to the protected site or to DataDome that failed. */
export class BrowserRequestError extends EzCaptchaError {
  /** The attempted request, such as `GET https://example.com/signup`, without its query. */
  readonly op: string;

  constructor(op: string, options?: { cause?: unknown }) {
    const detail = options?.cause instanceof Error ? options.cause.message : String(options?.cause);
    super(`${op}: ${detail}`, "browser-request", options);
    this.op = op;
  }
}

/** Whether a value is a {@link DataDomeError}. */
export function isDataDomeError(value: unknown): value is DataDomeError {
  return isEzCaptchaError(value) && value.kind === "datadome";
}

/** Whether a value is a {@link BrowserRequestError}. */
export function isBrowserRequestError(value: unknown): value is BrowserRequestError {
  return isEzCaptchaError(value) && value.kind === "browser-request";
}
