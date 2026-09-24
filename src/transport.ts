/**
 * The one place a request is actually sent.
 *
 * Cancellation and timeouts ride on `AbortSignal`, which is what the other
 * SDKs approximate with `context.Context`, `httpx.Timeout` and a tokio
 * deadline. `AbortSignal.any([caller, AbortSignal.timeout(ms)])` is exactly
 * `context.WithTimeout(ctx, ms)`: whichever fires first wins, and the caller's
 * own signal keeps working.
 *
 * It does one thing the others cannot do cheaply — tell a timeout apart from a
 * caller's cancellation after the fact, because `AbortSignal.timeout` aborts
 * with a `TimeoutError` while `AbortController.abort()` uses `AbortError`.
 *
 * @module
 */

import { TransportError } from "./errors.js";
import type { Logger } from "./logger.js";
import { redactBody } from "./logger.js";
import { CLIENT_KEY_HEADER, parseEnvelope, preview } from "./wire.js";

/** Everything one request needs that does not come from the body. */
export interface RequestContext {
  fetch: typeof globalThis.fetch;
  clientKey: string;
  userAgent: string;
  logger: Logger | undefined;
  /** The caller's cancellation signal, merged with this request's timeout. */
  signal?: AbortSignal | undefined;
}

/**
 * Posts a JSON body and returns the parsed envelope.
 *
 * @throws TransportError when the request never produced a response.
 * @throws ApiError when the service reported a structured error.
 * @throws UnexpectedResponseError when a 2xx body was not a JSON object.
 * @internal
 */
export async function postJson(
  context: RequestContext,
  url: string,
  body: unknown,
  timeout: number,
): Promise<Record<string, unknown>> {
  const payload = JSON.stringify(body);
  const operation = `POST ${url}`;

  logRequest(context.logger, url, payload);

  const startedAt = performance.now();
  let response: Response;
  try {
    response = await context.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": context.userAgent,
        [CLIENT_KEY_HEADER]: context.clientKey,
      },
      body: payload,
      signal: deadline(timeout, context.signal),
    });
  } catch (cause) {
    throw new TransportError(operation, {
      cause: describeFetchFailure(cause, timeout),
    });
  }

  let text: string;
  try {
    text = await response.text();
  } catch (cause) {
    // Headers arrived but the body broke off; that is still a transport failure.
    throw new TransportError(operation, {
      cause: describeFetchFailure(cause, timeout),
    });
  }

  logResponse(context.logger, url, response.status, performance.now() - startedAt, text);
  return parseEnvelope(response.status, text);
}

/**
 * Merges this request's deadline with the caller's signal.
 *
 * `AbortSignal.any` returns a signal that aborts when either does, carrying
 * the reason of whichever fired — which is what keeps
 * {@link describeFetchFailure} able to name the cause.
 */
function deadline(timeout: number, signal?: AbortSignal): AbortSignal {
  const timer = AbortSignal.timeout(timeout);
  return signal ? AbortSignal.any([signal, timer]) : timer;
}

/**
 * Turns an aborted or failed fetch into an error that says what happened.
 *
 * `fetch` rejects with a bare `TypeError: fetch failed` and buries the real
 * reason in `cause`, so unwrapping it here is what keeps the message useful.
 */
function describeFetchFailure(cause: unknown, timeout: number): Error {
  if (cause instanceof Error) {
    if (cause.name === "TimeoutError") {
      return new Error(`request timed out after ${timeout}ms`, { cause });
    }
    if (cause.name === "AbortError") {
      return new Error("request was aborted by the caller", { cause });
    }
    // undici buries the real reason in cause, leaving only "fetch failed" on top.
    const inner = (cause as { cause?: unknown }).cause;
    if (inner instanceof Error && cause.message === "fetch failed") {
      return inner;
    }
    return cause;
  }
  return new Error(String(cause));
}

/**
 * Logs an outgoing request with credentials redacted.
 *
 * The body is not rendered at all below trace, so this costs nothing at the
 * default level — `redactBody` parses and re-serialises, which is exactly the
 * work worth skipping.
 */
function logRequest(logger: Logger | undefined, url: string, body: string) {
  logger?.trace?.({ url, body: preview(redactBody(body)) }, "sending request");
}

/** Logs a response's status, duration, size and truncated body. */
function logResponse(
  logger: Logger | undefined,
  url: string,
  status: number,
  elapsedMs: number,
  body: string,
) {
  logger?.trace?.(
    {
      url,
      status,
      elapsedMs: Math.round(elapsedMs * 10) / 10,
      bytes: body.length,
      body: preview(body),
    },
    "received response",
  );
}

/**
 * Waits, and gives up early if the signal aborts.
 *
 * This is the polling interval. `setTimeout` from `timers/promises` would do
 * the same on Node, but importing it would tie the SDK to Node for no gain.
 *
 * @throws TransportError when the wait is cancelled.
 * @internal
 */
export function sleep(
  ms: number,
  signal: AbortSignal | undefined,
  operation: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new TransportError(operation, { cause: signal.reason }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new TransportError(operation, { cause: signal?.reason }));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
