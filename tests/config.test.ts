import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EzCapSolverClient } from "../src/client.js";
import {
  DEFAULT_MAX_POLL_ATTEMPTS,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_SYNC_TIMEOUT,
  DEFAULT_TIMEOUT,
  describeConfig,
  resolveConfig,
  resolvePolling,
  SDK_VERSION,
} from "../src/config.js";
import { consoleLogger, redact, redactBody } from "../src/logger.js";

const ENV_KEY = "EZCAPTCHA_API_KEY";
let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
});

afterEach(() => {
  if (savedKey === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedKey;
});

describe("resolving the client key", () => {
  it("falls back to the environment when none is passed", () => {
    process.env[ENV_KEY] = "from-env";
    expect(resolveConfig().clientKey).toBe("from-env");
  });

  it("prefers an explicit key over the environment", () => {
    process.env[ENV_KEY] = "from-env";
    expect(resolveConfig({ clientKey: "explicit" }).clientKey).toBe("explicit");
  });

  it("refuses a blank key, naming the environment variable that would supply one", () => {
    expect(() => resolveConfig()).toThrow(new RegExp(ENV_KEY));
    expect(() => resolveConfig({ clientKey: "   " })).toThrow(/must not be blank/);
  });

  it("refuses a key with characters a request cannot carry, before anything is sent", () => {
    for (const clientKey of ["key\nX-Injected: 1", " padded ", "kéy", "key\u0000"]) {
      expect(() => resolveConfig({ clientKey }), JSON.stringify(clientKey)).toThrow(
        /client key contains invalid characters/,
      );
    }
  });
});

describe("defaults", () => {
  it("matches the values the other SDKs use", () => {
    const config = resolveConfig({ clientKey: "k" });
    expect(config.asyncBaseUrl).toBe("https://api.ez-captcha.com");
    expect(config.syncBaseUrl).toBe("https://sync.ez-captcha.com");
    expect(config.timeout).toBe(DEFAULT_TIMEOUT);
    expect(config.syncTimeout).toBe(DEFAULT_SYNC_TIMEOUT);
    expect(config.polling).toEqual({
      interval: DEFAULT_POLL_INTERVAL,
      maxAttempts: DEFAULT_MAX_POLL_ATTEMPTS,
    });
  });

  it("keeps the two timeout budgets apart", () => {
    // A synchronous call blocks until the worker answers, so one shared value
    // would necessarily cut one of the two short.
    expect(DEFAULT_SYNC_TIMEOUT).toBeGreaterThan(DEFAULT_TIMEOUT);
    expect(DEFAULT_SYNC_TIMEOUT).toBeGreaterThan(180_000);
  });

  it("identifies itself and the runtime it is on", () => {
    const { userAgent } = resolveConfig({ clientKey: "k" });
    expect(userAgent).toContain(`ezcapsolver-js/${SDK_VERSION}`);
    expect(userAgent).toContain("node/");
  });

  it("takes only the polling fields that were overridden", () => {
    const config = resolveConfig({ clientKey: "k", polling: { interval: 500 } });
    expect(config.polling).toEqual({ interval: 500, maxAttempts: DEFAULT_MAX_POLL_ATTEMPTS });
  });

  it("trims a trailing slash so a joined path never doubles up", () => {
    const config = resolveConfig({ clientKey: "k", asyncBaseUrl: "https://api.example.com/" });
    expect(config.asyncBaseUrl).toBe("https://api.example.com");
  });
});

describe("rejecting a configuration that cannot work", () => {
  it("checks everything before anything is billed", () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ timeout: 0 }, /timeout must be greater than zero/],
      [{ timeout: -1 }, /timeout must be greater than zero/],
      [{ timeout: Number.NaN }, /timeout must be greater than zero/],
      [{ syncTimeout: 0 }, /sync timeout must be greater than zero/],
      [{ asyncBaseUrl: "" }, /async base URL must not be empty/],
      [{ asyncBaseUrl: "not a url" }, /not a valid URL/],
      [{ asyncBaseUrl: "ftp://example.com" }, /must use http or https/],
      [{ syncBaseUrl: "ws://example.com" }, /must use http or https/],
      [{ polling: { interval: 0 } }, /polling interval must be greater than zero/],
      [{ polling: { maxAttempts: 0 } }, /maximum polling attempts must be greater than zero/],
      [{ polling: { maxAttempts: 1.5 } }, /maximum polling attempts must be greater than zero/],
      [{ appId: 1.5 }, /app id must be an integer/],
    ];
    for (const [options, message] of cases) {
      expect(() => resolveConfig({ clientKey: "k", ...options }), String(message)).toThrow(message);
    }
  });

  it("says so when the runtime has no fetch to use", () => {
    expect(() =>
      resolveConfig({ clientKey: "k", fetch: undefined as unknown as typeof globalThis.fetch }),
    ).not.toThrow();
    expect(() =>
      resolveConfig({ clientKey: "k", fetch: "nope" as unknown as typeof globalThis.fetch }),
    ).toThrow(/no global fetch/);
  });

  it("validates a per-call polling override too", () => {
    const base = { interval: 1_000, maxAttempts: 10 };
    expect(resolvePolling(base, { interval: 50 })).toEqual({ interval: 50, maxAttempts: 10 });
    expect(() => resolvePolling(base, { maxAttempts: -1 })).toThrow(/maximum polling attempts/);
  });
});

describe("never leaking the credential", () => {
  it("leaves it off the configuration a client reports", () => {
    const client = new EzCapSolverClient({ clientKey: "super-secret" });
    // Not masked — absent. A value that is never returned cannot be logged by
    // accident.
    expect("clientKey" in client.config).toBe(false);
    expect(JSON.stringify(client.config)).not.toContain("super-secret");
  });

  it("shows whether one is set without showing what it is", () => {
    const config = resolveConfig({ clientKey: "k" });
    expect(describeConfig(config, true)).toContain("[REDACTED]");
    expect(describeConfig(config, true)).not.toContain("clientKey:k");
    expect(describeConfig(config, false)).toContain('clientKey:""');
  });

  it("replaces credentials at any nesting depth", () => {
    // clientKey sits at the envelope root but proxy sits inside task, and a
    // future field could nest further still.
    const redacted = redact({
      clientKey: "secret",
      task: { proxy: "http://u:p@h:1", websiteURL: "keep" },
      list: [{ clientKey: "also-secret" }],
    });
    expect(JSON.stringify(redacted)).not.toContain("secret");
    expect(JSON.stringify(redacted)).not.toContain("u:p@h");
    expect(JSON.stringify(redacted)).toContain("keep");
  });

  it("hands back a body it cannot parse rather than dropping it", () => {
    // A body that does not parse cannot hold a credential this SDK put there,
    // and its raw text is the only thing that explains it.
    expect(redactBody("<html>oops</html>")).toBe("<html>oops</html>");
  });
});

describe("the console logger", () => {
  it("drops everything below the level it was built with", () => {
    const logger = consoleLogger("warn");
    expect(logger.trace).toBeUndefined();
    expect(logger.debug).toBeUndefined();
    expect(logger.info).toBeUndefined();
    expect(logger.warn).toBeTypeOf("function");
    expect(logger.error).toBeTypeOf("function");
  });

  it("offers every level when asked for the lowest", () => {
    const logger = consoleLogger("trace");
    for (const level of ["trace", "debug", "info", "warn", "error"] as const) {
      expect(logger[level]).toBeTypeOf("function");
    }
  });
});
