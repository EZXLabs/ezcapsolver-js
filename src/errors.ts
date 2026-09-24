/**
 * Failure model.
 *
 * Failures are classified by what the caller can do about them, not by where
 * they came from: a configuration mistake needs a code change, a transport
 * fault needs the network looked at, an API error needs its code inspected.
 *
 * Every error is an {@link EzCaptchaError} carrying a {@link ErrorKind}
 * discriminator. Narrow with the exported type guards rather than `instanceof`
 * — see {@link isEzCaptchaError} for why.
 *
 * @module
 */

/**
 * Registry-wide brand identifying an error produced by this SDK.
 *
 * `Symbol.for` shares one symbol across every copy of the package in a
 * process, which `instanceof` cannot do — see {@link isEzCaptchaError}.
 */
const BRAND = Symbol.for("ezcapsolver.error");

/** Characters of a raw value kept in an error message. */
const ERROR_PREVIEW_CHARS = 512;

/**
 * Which failure layer an error belongs to.
 *
 * The five layers match the other language SDKs one for one (E1 through E5).
 * `wait-interrupted` is not a sixth layer: it wraps one of the others and
 * keeps the wrapped error reachable through `cause`.
 */
export type ErrorKind =
  /** E1 — invalid client configuration. Retrying is pointless. */
  | "config"
  /** E2 — the request never produced a response: DNS, TCP, TLS, timeout. */
  | "transport"
  /** E3 — a structured error reported by the service. */
  | "api"
  /** E4 — the task never reached a terminal state within the budget. */
  | "polling-exhausted"
  /** E5 — the response did not parse, or parsed but broke the contract. */
  | "unexpected-response"
  /** E5 — a raw solution did not fit its model. */
  | "solution-decode"
  /** A task was created and billed, but waiting for its result failed. */
  | "wait-interrupted";

/**
 * Base class for every failure raised by this SDK.
 *
 * Construct it directly only for configuration failures, which carry nothing
 * but a description — see {@link configError}.
 */
export class EzCaptchaError extends Error {
  /** Which failure layer this belongs to. */
  readonly kind: ErrorKind;

  /** @internal Brand checked by {@link isEzCaptchaError}. */
  readonly [BRAND]: true = true;

  constructor(message: string, kind: ErrorKind = "config", options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.kind = kind;
  }
}

/**
 * Builds a configuration failure (E1).
 *
 * Configuration errors have no structured data worth a dedicated class — the
 * reason is the whole payload — so they use the base class. Keep new
 * validations on this helper rather than reintroducing a type for them.
 *
 * @internal
 */
export function configError(detail: string): EzCaptchaError {
  return new EzCaptchaError(`invalid client configuration: ${detail}`, "config");
}

/**
 * A failure below the HTTP response (E2): the request never produced one.
 *
 * Whether it is safe to send the request again depends on the operation:
 * creating a task is billed and is not idempotent, and a timeout cannot tell
 * you whether the service already accepted the task.
 */
export class TransportError extends EzCaptchaError {
  /**
   * The attempted operation, such as
   * `POST https://api.ez-captcha.com/createTask`. Never contains credentials.
   */
  readonly op: string;

  constructor(op: string, options?: { cause?: unknown }) {
    const detail = options?.cause instanceof Error ? options.cause.message : String(options?.cause);
    super(`${op}: ${detail}`, "transport", options);
    this.op = op;
  }
}

/** Fields carried by an {@link ApiError}. */
export interface ApiErrorFields {
  /**
   * The stable machine-readable code, such as `ERROR_ZERO_BALANCE`. Empty when
   * the response carried no error envelope.
   */
  errorCode: string;
  /**
   * The human-readable description. When the response was not JSON, this holds
   * a slice of the raw body instead.
   */
  errorDescription: string;
  /** The HTTP status that carried the error. Always set. */
  httpStatus: number;
  /**
   * Field path to validation message. Populated only on a parameter validation
   * failure.
   */
  errors?: Readonly<Record<string, string>> | undefined;
  /** The service-side request tracking identifier, when present. */
  requestId?: string | undefined;
  /**
   * Filled in by the SDK for failures after a task was created; the service
   * does not echo it back.
   */
  taskId?: string | undefined;
}

/**
 * A structured error reported by the service (E3).
 *
 * This covers both a business error carried by a 200 response and any non-2xx
 * status, so {@link ApiError.httpStatus} is always readable from one place.
 * The service signals failure with `errorId`, not with the HTTP status: most
 * business errors arrive as HTTP 500 and a failed task arrives as HTTP 200.
 */
export class ApiError extends EzCaptchaError {
  readonly errorCode: string;
  readonly errorDescription: string;
  readonly httpStatus: number;
  readonly errors: Readonly<Record<string, string>> | undefined;
  readonly requestId: string | undefined;
  /** Set by the SDK once a task exists; see {@link taskIdOf}. */
  taskId: string | undefined;

  constructor(fields: ApiErrorFields) {
    super(formatApiError(fields), "api");
    this.errorCode = fields.errorCode;
    this.errorDescription = fields.errorDescription;
    this.httpStatus = fields.httpStatus;
    this.errors = fields.errors;
    this.requestId = fields.requestId;
    this.taskId = fields.taskId;
  }

  /**
   * Whether this is a credential or balance problem.
   *
   * A caller that retries these is not merely wasting a call: the service
   * counts them per key, and thirty within a minute earn a three-minute ban.
   * Stop instead of backing off.
   */
  isAuthenticationError(): boolean {
    return AUTHENTICATION_ERROR_CODES.has(this.errorCode);
  }

  /**
   * Whether resending the identical request would produce the identical
   * failure.
   *
   * An unknown code returns `false`, because a code this release has not seen
   * may well be transient; that keeps the SDK from talking a caller out of a
   * retry that would have worked. The codes it does not recognise as terminal
   * are not promised to be retryable either — the retry policy stays with the
   * caller.
   */
  isTerminal(): boolean {
    return TERMINAL_ERROR_CODES.has(this.errorCode);
  }

  /**
   * Whether the service refused the request for throttling rather than for
   * anything about the request itself.
   *
   * Both codes are transient by construction: a rate limit resets with its
   * window and a ban expires on its own. Neither says anything about a task —
   * the query is refused before the service looks it up — so
   * {@link EzCapSolverClient.waitForResult} treats one as a skipped attempt
   * instead of a failed task, and a caller polling by hand with
   * {@link EzCapSolverClient.getTaskResult} should do the same.
   *
   * This is narrower than the negation of {@link ApiError.isTerminal}, which is
   * also false for every unknown code — including the worker codes that report
   * a task that genuinely failed.
   */
  isRateLimited(): boolean {
    return RATE_LIMITED_ERROR_CODES.has(this.errorCode);
  }
}

/**
 * Renders the code, description and status on one line, with the field paths
 * appended when the failure was a validation error. Callers commonly log
 * nothing but the error, so everything actionable has to be in this line.
 */
function formatApiError(fields: ApiErrorFields): string {
  const code = fields.errorCode || "UNKNOWN_API_ERROR";
  const description = fields.errorDescription || "The API returned an unspecified error";
  let message = `${code}: ${description} (HTTP ${fields.httpStatus})`;

  const entries = Object.entries(fields.errors ?? {});
  if (entries.length > 0) {
    // Sorting keeps one set of validation errors rendering identically every
    // time, so two log lines stay comparable.
    entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    message += entries
      .map(([field, reason], index) => `${index === 0 ? "; " : ", "}${field}: ${reason}`)
      .join("");
  }
  return message;
}

/**
 * Codes that trigger the service's per-key ban counter. Sourced from the
 * `@ApiDefenses` annotations on the service's AsyncTaskController: /createTask
 * bans a key for three minutes after thirty of these within one minute, and
 * /getTaskResult for one minute after thirty of the first two.
 */
const AUTHENTICATION_ERROR_CODES: ReadonlySet<string> = new Set([
  "ERROR_KEY_DOES_NOT_EXIST",
  "ERROR_KEY_NOT_AVAILABLE",
  "ERROR_ZERO_BALANCE",
]);

/**
 * Codes for which an identical request yields an identical failure. Derived
 * from the service's TaskResponseCode enum; the rest are left out because an
 * internal error, a rate limit, a ban and the two synchronous worker faults
 * (ERROR_SERVICE_UNAVAILABLE, ERROR_SERVICE_TIMEOUT) can all clear on their
 * own.
 */
const TERMINAL_ERROR_CODES: ReadonlySet<string> = new Set([
  "ERROR_CONTENT_TYPE_ERROR",
  "ERROR_KEY_DOES_NOT_EXIST",
  "ERROR_KEY_NOT_AVAILABLE",
  "ERROR_NOT_FOUND",
  "ERROR_PACKAGE_NOT_EXIST",
  "ERROR_PACKAGE_TASK_TYPE_NOT_SUPPORTED",
  "ERROR_REQUEST_METHOD",
  "ERROR_REQUEST_PARAMETERS",
  "ERROR_REQUEST_PROXY_MISSING",
  "ERROR_SUBSCRIPTION_EXPIRED",
  "ERROR_TASK_NOT_EXIST",
  "ERROR_TASK_TYPE_NOT_ALLOWED",
  "ERROR_TASK_TYPE_NOT_AVAILABLE",
  "ERROR_TASK_TYPE_NOT_SUPPORTED",
  "ERROR_WEBSITE_NOT_ALLOWED",
  "ERROR_ZERO_BALANCE",
]);

/**
 * The service's two throttling codes, both HTTP 429. /getTaskResult counts only
 * the first two authentication codes towards its ban counter, so polling
 * through a refusal does not dig the hole deeper.
 */
const RATE_LIMITED_ERROR_CODES: ReadonlySet<string> = new Set([
  "ERROR_REQUEST_LIMIT",
  "ERROR_REQUEST_BANNED",
]);

/**
 * The polling budget ran out before the task reached a terminal state (E4).
 *
 * The task itself may still be running, and it has already been billed, so
 * hand {@link PollingExhaustedError.taskId} to `waitForResult` rather than
 * paying for the same work twice. The service holds a result for five minutes
 * after creation; past that the id comes back as `ERROR_TASK_NOT_EXIST`.
 */
export class PollingExhaustedError extends EzCaptchaError {
  /** Identifies the unfinished task. */
  readonly taskId: string;
  /** The number of result queries that completed. */
  readonly attempts: number;
  /** The delay applied between queries, in milliseconds. */
  readonly interval: number;

  constructor(taskId: string, attempts: number, interval: number) {
    super(
      `task ${JSON.stringify(taskId)} did not complete after ${attempts} ` +
        `polling attempts at ${interval}ms intervals`,
      "polling-exhausted",
    );
    this.taskId = taskId;
    this.attempts = attempts;
    this.interval = interval;
  }
}

/**
 * A task was created and billed, but its result never arrived: the wait broke
 * off on a dropped connection, a gateway, an aborted signal, or a response
 * that did not match the contract.
 *
 * `solve` creates the task internally, so this error is the only place its
 * identifier appears. Recover by waiting on the same task again with
 * `waitForResult` rather than creating a second one: the service holds a
 * result for five minutes after creation, and a new task is billed again.
 *
 * It wraps the underlying failure rather than replacing it, so the original
 * classification stays reachable through `cause`.
 *
 * Errors that carry the identifier themselves are not wrapped: a business
 * failure still arrives as an {@link ApiError} with `taskId` set, and an
 * exhausted budget as a {@link PollingExhaustedError}.
 */
export class WaitInterruptedError extends EzCaptchaError {
  /** Identifies the task that was created and billed. */
  readonly taskId: string;
  /** Correlation id of the creating request, when the service supplied one. */
  readonly requestId: string | undefined;

  constructor(taskId: string, requestId: string | undefined, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(
      `task ${JSON.stringify(taskId)} was created but waiting for its result failed: ${detail}`,
      "wait-interrupted",
      { cause },
    );
    this.taskId = taskId;
    this.requestId = requestId;
  }
}

/**
 * A response the SDK could not use (E5): it did not parse, or it parsed but
 * broke the API contract.
 */
export class UnexpectedResponseError extends EzCaptchaError {
  /** States what was wrong with the response. */
  readonly reason: string;
  /** A slice of the raw response body, often the only thing left to diagnose with. */
  readonly body: string;

  constructor(reason: string, body = "") {
    super(
      body
        ? `unexpected API response: ${reason}; body: ${body}`
        : `unexpected API response: ${reason}`,
      "unexpected-response",
    );
    this.reason = reason;
    this.body = body;
  }
}

/**
 * A raw solution that did not fit its model (E5).
 *
 * The raw value travels with the error. A decode failure means the worker
 * returned a shape this release does not model, and that shape is precisely
 * what is needed to diagnose it.
 */
export class SolutionDecodeError extends EzCaptchaError {
  /** The complete solution JSON, untruncated. */
  readonly raw: string;

  constructor(raw: string, reason: string, options?: { cause?: unknown }) {
    super(
      `failed to decode task solution: ${reason}; raw solution: ${preview(raw)}`,
      "solution-decode",
      options,
    );
    this.raw = raw;
  }
}

/**
 * Describes a ready result that carried no solution field at all, which is not
 * the same as a null solution. Both entry points into solution decoding report
 * it, so the wording lives here rather than twice.
 *
 * @internal
 */
export const MISSING_SOLUTION_REASON = "ready task result does not contain a solution";

/**
 * Whether a value is an error raised by this SDK.
 *
 * Prefer this over `instanceof EzCaptchaError`. A package published in both
 * ESM and CJS can be loaded twice in one process, producing two unrelated
 * class objects; `instanceof` then fails for an error that genuinely came from
 * this SDK. The brand is a `Symbol.for` key, which is shared process-wide.
 */
export function isEzCaptchaError(value: unknown): value is EzCaptchaError {
  return typeof value === "object" && value !== null && BRAND in value;
}

/** Whether a value is an {@link ApiError}. */
export function isApiError(value: unknown): value is ApiError {
  return isEzCaptchaError(value) && value.kind === "api";
}

/** Whether a value is a {@link TransportError}. */
export function isTransportError(value: unknown): value is TransportError {
  return isEzCaptchaError(value) && value.kind === "transport";
}

/** Whether a value is a {@link PollingExhaustedError}. */
export function isPollingExhaustedError(value: unknown): value is PollingExhaustedError {
  return isEzCaptchaError(value) && value.kind === "polling-exhausted";
}

/** Whether a value is a {@link WaitInterruptedError}. */
export function isWaitInterruptedError(value: unknown): value is WaitInterruptedError {
  return isEzCaptchaError(value) && value.kind === "wait-interrupted";
}

/**
 * Whether a value is a decoding failure (E5): either an
 * {@link UnexpectedResponseError} or a {@link SolutionDecodeError}.
 */
export function isDecodeError(
  value: unknown,
): value is UnexpectedResponseError | SolutionDecodeError {
  return (
    isEzCaptchaError(value) &&
    (value.kind === "unexpected-response" || value.kind === "solution-decode")
  );
}

/**
 * Returns the identifier of a task that was created and billed, when `error`
 * left one behind, and `undefined` when it did not.
 *
 * Creating a task is what costs money, so a failure after that point leaves a
 * result worth recovering: wait on this identifier again with `waitForResult`
 * instead of creating a second task. The service holds a result for five
 * minutes after creation.
 *
 * `undefined` means nothing was billed — the failure happened before or during
 * task creation, so there is nothing to recover.
 *
 * Which error type carries the identifier is an implementation detail; this is
 * the one place to ask.
 *
 * @example
 * ```ts
 * const taskId = taskIdOf(error);
 * if (taskId !== undefined) {
 *   const result = await client.waitForResult(taskId);
 * }
 * ```
 */
export function taskIdOf(error: unknown): string | undefined {
  // Walk the cause chain, which is what errors.As does in Go and source() in Rust.
  for (let current = error, depth = 0; current != null && depth < 32; depth++) {
    if (isEzCaptchaError(current)) {
      if (
        current.kind === "wait-interrupted" ||
        current.kind === "polling-exhausted" ||
        current.kind === "api"
      ) {
        const { taskId } = current as { taskId?: string | undefined };
        if (taskId) return taskId;
      }
    }
    if (!(current instanceof Error)) break;
    current = current.cause;
  }
  return undefined;
}

/** Truncates a body to {@link ERROR_PREVIEW_CHARS}, marking the cut with an ellipsis. */
function preview(text: string): string {
  // Cut on code points, so a surrogate pair is never split in half into mojibake.
  const points = [...text];
  return points.length <= ERROR_PREVIEW_CHARS
    ? text
    : `${points.slice(0, ERROR_PREVIEW_CHARS).join("")}...`;
}
