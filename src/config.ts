/**
 * Client configuration: defaults, options and validation.
 *
 * Every default here is shared with the Rust, Go and Python SDKs. Overriding
 * any of them is a per-client decision; the ones not overridden keep these
 * values.
 *
 * @module
 */

import { configError } from "./errors.js";
import type { Logger } from "./logger.js";

/** Serves asynchronous tasks and balance queries. */
export const DEFAULT_ASYNC_BASE_URL = "https://api.ez-captcha.com";

/**
 * Serves synchronous tasks. The service splits the two deployments, so they
 * cannot share one host.
 */
export const DEFAULT_SYNC_BASE_URL = "https://sync.ez-captcha.com";

/** Read when no client key is supplied explicitly. */
export const DEFAULT_CLIENT_KEY_ENV = "EZCAPTCHA_API_KEY";

/**
 * Bounds one call to an asynchronous endpoint or the balance endpoint, in
 * milliseconds.
 *
 * Those are millisecond-scale enqueue and lookup operations, so a short bound
 * keeps a network fault distinguishable from a slow service.
 */
export const DEFAULT_TIMEOUT = 30_000;

/**
 * Bounds one call to the synchronous task endpoint, in milliseconds.
 *
 * A synchronous call blocks until the worker answers, and the service grants
 * its slowest synchronous types a 180-second worker deadline. Sharing
 * {@link DEFAULT_TIMEOUT} would abort a call that has already been billed, and
 * a call that times out never receives the task ID it would take to recover
 * the result. Matching 180 seconds exactly would leave no margin for the
 * network and the service's own overhead, so this adds one minute of headroom.
 */
export const DEFAULT_SYNC_TIMEOUT = 240_000;

/** Separates two result queries, in milliseconds. */
export const DEFAULT_POLL_INTERVAL = 3_000;

/**
 * Caps the number of result queries, which with {@link DEFAULT_POLL_INTERVAL}
 * puts the wait ceiling at two and a half minutes.
 */
export const DEFAULT_MAX_POLL_ATTEMPTS = 50;

/** Replaces a credential in debug output. */
export const REDACTED_PLACEHOLDER = "[REDACTED]";

/** Controls how an asynchronous task is waited on. */
export interface PollingConfig {
  /**
   * The delay applied before every result query, the first one included, in
   * milliseconds.
   *
   * A task that was just created is still queued for a worker, so querying
   * immediately after creation almost always reports processing.
   */
  interval: number;
  /**
   * The number of result queries allowed before `PollingExhaustedError` is
   * raised.
   */
  maxAttempts: number;
}

/** The polling settings a client starts with. */
export function defaultPolling(): PollingConfig {
  return {
    interval: DEFAULT_POLL_INTERVAL,
    maxAttempts: DEFAULT_MAX_POLL_ATTEMPTS,
  };
}

/**
 * Options accepted by the client constructor.
 *
 * Anything left out keeps its default. This mirrors Go's `Option` values,
 * Rust's builder and Python's keyword arguments.
 */
export interface ClientOptions {
  /**
   * The client key. Falls back to the `EZCAPTCHA_API_KEY` environment
   * variable, which is the only place this is read from implicitly.
   */
  clientKey?: string | undefined;
  /** Serves asynchronous tasks and balance queries. */
  asyncBaseUrl?: string | undefined;
  /** Serves synchronous tasks. */
  syncBaseUrl?: string | undefined;
  /** Bounds one asynchronous or balance request, in milliseconds. */
  timeout?: number | undefined;
  /** Bounds one synchronous task request, in milliseconds. */
  syncTimeout?: number | undefined;
  /** Controls how an asynchronous task is waited on. */
  polling?: Partial<PollingConfig> | undefined;
  /** The optional developer application identifier. */
  appId?: number | undefined;
  /** Sent with every request. */
  userAgent?: string | undefined;
  /** Receives the SDK's logs. Without one, logging is discarded. */
  logger?: Logger | undefined;
  /**
   * Sends the requests.
   *
   * This is the extension point for anything the platform `fetch` does not do
   * on its own — an outbound proxy, a tuned connection pool, or a test double.
   *
   * Unlike the other SDKs there is no `proxy` option, because a proxy needs a
   * dispatcher and only Node's `undici` supplies one. Pass it through here:
   *
   * ```ts
   * import { ProxyAgent } from "undici";
   *
   * const dispatcher = new ProxyAgent("http://user:pass@proxy.example:8080");
   * const client = new EzCapSolverClient({
   *   fetch: (url, init) => fetch(url, { ...init, dispatcher } as RequestInit),
   * });
   * ```
   */
  fetch?: typeof globalThis.fetch | undefined;
}

/**
 * The effective configuration of a client.
 *
 * Read it back with `client.config`. The client key is deliberately absent:
 * it is a credential, and leaving it out means logging a config can never leak
 * it.
 */
export interface ClientConfig {
  readonly asyncBaseUrl: string;
  readonly syncBaseUrl: string;
  readonly timeout: number;
  readonly syncTimeout: number;
  readonly polling: Readonly<PollingConfig>;
  readonly appId: number | undefined;
  readonly userAgent: string;
}

/** Everything {@link resolveConfig} produces, credentials included. @internal */
export interface ResolvedConfig extends ClientConfig {
  readonly clientKey: string;
  readonly logger: Logger | undefined;
  readonly fetch: typeof globalThis.fetch;
}

/**
 * Reads the client key from the environment, where one is available.
 *
 * Deno and Workers have no `process`, so this has to be defensive rather than
 * assume Node.
 */
function clientKeyFromEnv(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.[DEFAULT_CLIENT_KEY_ENV];
}

/**
 * Applies defaults to {@link ClientOptions} and validates the result.
 *
 * Everything checkable without a network call is checked here, so an invalid
 * setting fails at construction rather than on the first request — before
 * anything is billed.
 *
 * @throws EzCaptchaError of kind `config` when a setting is unusable.
 * @internal
 */
export function resolveConfig(options: ClientOptions = {}): ResolvedConfig {
  const clientKey = options.clientKey ?? clientKeyFromEnv() ?? "";
  const polling: PollingConfig = { ...defaultPolling(), ...options.polling };

  const resolved: ResolvedConfig = {
    clientKey,
    asyncBaseUrl: trimTrailingSlash(options.asyncBaseUrl ?? DEFAULT_ASYNC_BASE_URL),
    syncBaseUrl: trimTrailingSlash(options.syncBaseUrl ?? DEFAULT_SYNC_BASE_URL),
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    syncTimeout: options.syncTimeout ?? DEFAULT_SYNC_TIMEOUT,
    polling,
    appId: options.appId,
    userAgent: options.userAgent || defaultUserAgent(),
    logger: options.logger,
    fetch: options.fetch ?? globalThis.fetch,
  };

  validate(resolved);
  return resolved;
}

/** Rejects settings that would make a request or a wait meaningless. */
function validate(config: ResolvedConfig): void {
  if (config.clientKey.trim() === "") {
    throw configError(
      "client key must not be blank; pass `clientKey` or set the " +
        `${DEFAULT_CLIENT_KEY_ENV} environment variable`,
    );
  }
  // The key also travels in a request header, and fetch refuses a header value
  // with control characters or anything outside Latin-1. Catching that here
  // beats failing every request later with an opaque transport error.
  if (!/^[\x20-\x7e]+$/.test(config.clientKey) || config.clientKey !== config.clientKey.trim()) {
    throw configError("client key contains invalid characters");
  }
  if (!Number.isFinite(config.timeout) || config.timeout <= 0) {
    throw configError("timeout must be greater than zero");
  }
  if (!Number.isFinite(config.syncTimeout) || config.syncTimeout <= 0) {
    throw configError("sync timeout must be greater than zero");
  }
  assertUsableBaseUrl(config.asyncBaseUrl, "async");
  assertUsableBaseUrl(config.syncBaseUrl, "sync");
  validatePolling(config.polling);
  if (typeof config.fetch !== "function") {
    throw configError("fetch is not a function, and this runtime has no global fetch");
  }
  if (config.appId !== undefined && !Number.isInteger(config.appId)) {
    throw configError("app id must be an integer");
  }
}

/** Rejects polling settings that would make waiting meaningless. */
function validatePolling(polling: PollingConfig): void {
  if (!Number.isFinite(polling.interval) || polling.interval <= 0) {
    throw configError("polling interval must be greater than zero");
  }
  if (!Number.isInteger(polling.maxAttempts) || polling.maxAttempts <= 0) {
    throw configError("maximum polling attempts must be greater than zero");
  }
}

/**
 * Validates a per-call polling override.
 *
 * @throws EzCaptchaError of kind `config`.
 * @internal
 */
export function resolvePolling(
  base: Readonly<PollingConfig>,
  override?: Partial<PollingConfig>,
): PollingConfig {
  const polling: PollingConfig = { ...base, ...override };
  validatePolling(polling);
  return polling;
}

/** Rejects a base URL that is not an absolute http(s) URL. */
function assertUsableBaseUrl(value: string, which: string): void {
  if (value === "") {
    throw configError(`${which} base URL must not be empty`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw configError(`${which} base URL is not a valid URL: ${value}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw configError(`${which} base URL must use http or https, got ${parsed.protocol}`);
  }
}

/** Drops a trailing slash so joining a path never produces a double slash. */
function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Renders a configuration for logging, with the credential omitted entirely.
 *
 * {@link ClientConfig} has no `clientKey` field, so this cannot leak one — but
 * it is exported so that debug output matches the other SDKs' `String()`.
 */
export function describeConfig(config: ClientConfig, hasClientKey: boolean): string {
  return (
    `ClientConfig{clientKey:${hasClientKey ? REDACTED_PLACEHOLDER : '""'} ` +
    `asyncBaseUrl:${config.asyncBaseUrl} syncBaseUrl:${config.syncBaseUrl} ` +
    `timeout:${config.timeout}ms syncTimeout:${config.syncTimeout}ms ` +
    `polling:{interval:${config.polling.interval}ms maxAttempts:${config.polling.maxAttempts}} ` +
    `appId:${config.appId ?? "<unset>"} userAgent:${config.userAgent}}`
  );
}

/** Identifies the SDK and the runtime it is on. */
function defaultUserAgent(): string {
  const versions = (globalThis as { process?: { versions?: Record<string, string> } }).process
    ?.versions;
  const runtime = versions?.["node"] ? ` node/${versions["node"]}` : "";
  return `ezcapsolver-js/${SDK_VERSION}${runtime}`;
}

/**
 * The version of this SDK.
 *
 * Kept in sync with package.json by a test; the release workflow fails when a
 * tag does not match it.
 */
export const SDK_VERSION = "0.1.0";
