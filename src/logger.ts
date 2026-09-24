/**
 * Logging facade.
 *
 * The other SDKs log through their ecosystem's facade — `tracing` in Rust,
 * `log/slog` in Go, `logging` in Python — rather than picking an
 * implementation for the caller. JavaScript has no standard facade, so this
 * module defines the smallest one that fits: a structural interface any real
 * logger already satisfies.
 *
 * The signature is `(fields, message)`, which is pino's shape, so a pino
 * instance can be passed straight in:
 *
 * ```ts
 * import pino from "pino";
 * const client = new EzCapSolverClient({ logger: pino({ level: "trace" }) });
 * ```
 *
 * @module
 */

/** Structured fields attached to one log record. */
export type LogFields = Record<string, unknown>;

/** One level's logging method. Every level is optional. */
export type LogMethod = (fields: LogFields, message: string) => void;

/**
 * Receives the SDK's logs.
 *
 * Every method is optional: a logger that implements only `debug` and `error`
 * is valid, and the levels it leaves out are discarded.
 *
 * `trace` carries full request and response bodies with credentials redacted.
 * Nothing is even rendered below that level, so leaving it off costs nothing.
 */
export interface Logger {
  trace?: LogMethod;
  debug?: LogMethod;
  info?: LogMethod;
  warn?: LogMethod;
  error?: LogMethod;
}

/** Levels in increasing order of severity. */
export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;

/** One of {@link LOG_LEVELS}. */
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * A {@link Logger} that writes to the console, for when a real logger would be
 * more setup than the task is worth.
 *
 * `console` cannot be passed directly: its `trace` prints a stack trace rather
 * than a trace-level record, which is not what this SDK means by trace.
 *
 * @param minLevel Records below this level are dropped. Defaults to `info`.
 */
export function consoleLogger(minLevel: LogLevel = "info"): Logger {
  const threshold = LOG_LEVELS.indexOf(minLevel);
  const logger: Logger = {};

  for (const [index, level] of LOG_LEVELS.entries()) {
    if (index < threshold) continue;
    // console.trace prints a stack trace rather than a trace-level record, so
    // both of those levels go to console.debug.
    const sink =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : level === "info"
            ? console.info
            : console.debug;
    logger[level] = (fields, message) => {
      sink(`[ezcapsolver] ${level.toUpperCase()} ${message}`, fields);
    };
  }
  return logger;
}

/** Replaces a credential in any human-readable output. */
const REDACTED_PLACEHOLDER = "[REDACTED]";

/**
 * JSON keys whose values are credentials.
 *
 * `clientKey` authenticates the account and `proxy` usually embeds a username
 * and password, so neither may reach a log sink.
 */
const REDACTED_KEYS: ReadonlySet<string> = new Set(["clientKey", "proxy"]);

/**
 * Replaces credential values in a decoded JSON document, at any depth.
 *
 * Depth matters: `clientKey` sits at the envelope root but `proxy` sits inside
 * `task`, and a future field could nest further still.
 *
 * @internal
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = REDACTED_KEYS.has(key) ? REDACTED_PLACEHOLDER : redact(item);
    }
    return result;
  }
  return value;
}

/**
 * Renders a JSON body with credentials redacted, for trace logging.
 *
 * A body that does not parse is returned as-is: it cannot contain a credential
 * this SDK put there, and its raw text is the only thing that explains it.
 *
 * @internal
 */
export function redactBody(body: string): string {
  try {
    return JSON.stringify(redact(JSON.parse(body)));
  } catch {
    return body;
  }
}
