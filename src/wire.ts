/**
 * Request construction and envelope parsing. Pure functions, no I/O.
 *
 * ## Why there is no field-mapping layer here
 *
 * Go spends a reflection-driven module flattening an `Extra` map into the
 * payload and mapping struct fields to JSON keys; Python spends a `wire()`
 * field descriptor and a `Model.to_dict()` doing the same. Both exist because
 * their models are closed structures that do not equal the wire shape.
 *
 * A TypeScript task model *is* the wire shape — the service already speaks
 * camelCase, so no renaming is needed, and unmodelled parameters are just more
 * keys on the same object. Building a payload is therefore a spread, and the
 * precedence rule the other two implement with `setdefault` and an explicit
 * "written last" comment falls out of spread order.
 *
 * @module
 */

import { ApiError, UnexpectedResponseError } from "./errors.js";
import type { TaskType } from "./task-type.js";

/**
 * API paths. All three controllers also mount under `/solver/v1`, but the root
 * paths are what existing clients use, so the SDK stays on those.
 */
export const PATH = {
  createTask: "/createTask",
  getTaskResult: "/getTaskResult",
  createSyncTask: "/createSyncTask",
  getBalance: "/getBalance",
} as const;

/** Header carrying the client key on every request, alongside the `clientKey` body field. */
export const CLIENT_KEY_HEADER = "X-API-Key";

/**
 * Body characters retained in logs.
 *
 * Error envelopes fit; solved tokens and oversized task parameters are
 * truncated, which is the point.
 */
const LOG_PREVIEW = 256;

/** Response body characters retained in errors. Context beats brevity here. */
const ERROR_PREVIEW = 512;

/** Joins a base URL and a path, tolerating slashes on either side. */
export function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Truncates overlong text, marking the cut with an ellipsis. */
export function preview(text: string, limit: number = LOG_PREVIEW): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}...`;
}

/** The body of `/createTask` and `/createSyncTask`. */
export interface CreateTaskBody {
  clientKey: string;
  task: Record<string, unknown> & { type: TaskType };
  appId?: number;
}

/**
 * Builds the body for `createTask` and `createSyncTask`.
 *
 * The task type goes in as a `type` key *inside* the task object, which is the
 * shape the service requires. It is spread last so the SDK's choice always
 * wins over a `type` carried in the parameters. A caller who reached for one
 * task type and sent another would get a task billed and executed as the
 * second one while the result was decoded as the first.
 */
export function createTaskBody(
  clientKey: string,
  taskType: TaskType,
  params: Record<string, unknown>,
  appId?: number,
): CreateTaskBody {
  const body: CreateTaskBody = {
    clientKey,
    task: { ...params, type: taskType },
  };
  if (appId !== undefined) body.appId = appId;
  return body;
}

/** The body of `/getTaskResult`. */
export function taskResultBody(clientKey: string, taskId: string): Record<string, unknown> {
  return { clientKey, taskId };
}

/** The body of `/getBalance`. */
export function balanceBody(clientKey: string): Record<string, unknown> {
  return { clientKey };
}

/**
 * Parses the response envelope.
 *
 * @throws ApiError when `errorId` is non-zero, or the status is not 2xx.
 * @throws UnexpectedResponseError when a 2xx body is not a JSON object.
 */
export function parseEnvelope(status: number, text: string): Record<string, unknown> {
  const envelope = parseJsonObject(status, text);

  // errorId is the sole criterion: the service sets it on every response, and 0
  // means success. Treating a non-empty errorCode as a second failure signal
  // could reject a solved task if success codes are added later.
  if (Number(envelope["errorId"] ?? 0) !== 0) {
    throw new ApiError({
      errorCode: asString(envelope["errorCode"]) ?? "",
      errorDescription: asString(envelope["errorDescription"]) ?? "",
      httpStatus: status,
      errors: asStringRecord(envelope["errors"]),
      requestId: asString(envelope["requestId"]),
    });
  }

  if (!isSuccessStatus(status)) throw statusOnlyError(status, text);
  return envelope;
}

/**
 * Decodes the body into the object every endpoint is documented to return.
 *
 * A body that is not a JSON object means different things either side of the
 * status line: on a failure it is a server error that simply carried no
 * envelope, and is reported as one so the status is always readable from the
 * same place; on a success it is a broken contract.
 */
function parseJsonObject(status: number, text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (cause) {
    if (!isSuccessStatus(status)) throw statusOnlyError(status, text);
    throw new UnexpectedResponseError(
      `response body is not valid JSON: ${cause instanceof Error ? cause.message : cause}`,
      preview(text, ERROR_PREVIEW),
    );
  }

  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  if (!isSuccessStatus(status)) throw statusOnlyError(status, text);
  throw new UnexpectedResponseError(
    `expected a JSON object, got ${describeJson(parsed)}`,
    preview(text, ERROR_PREVIEW),
  );
}

/** Whether the status line reported success. */
function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/** Names a JSON value's type for an error message. */
function describeJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
}

/** Builds an error for a non-success response that carried no envelope. */
function statusOnlyError(status: number, text: string): ApiError {
  return new ApiError({
    errorCode: "",
    errorDescription: preview(text, ERROR_PREVIEW),
    httpStatus: status,
  });
}

/** Narrows a value to a string, or `undefined` when it is anything else. */
export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Narrows a value to a string map, dropping non-string entries. */
function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") result[key] = item;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
