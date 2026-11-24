import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SDK_VERSION } from "../src/config.js";
import * as extApi from "../src/ext/index.js";
import * as publicApi from "../src/index.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  name: string;
  version: string;
  type: string;
  engines: { node: string };
  exports: Record<string, unknown>;
  files: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

describe("the published package", () => {
  it("keeps SDK_VERSION and package.json in step", () => {
    // This constant ends up in the User-Agent. The release workflow checks it
    // too, but finding out there is too late: an npm version, once published,
    // cannot be replaced.
    expect(SDK_VERSION).toBe(packageJson.version);
  });

  it("ships no runtime dependencies", () => {
    // Adding a runtime dependency is a decision worth discussing, not one that
    // should happen quietly.
    expect(packageJson.dependencies ?? {}).toEqual({});
  });

  it("leaves lkrequest-js, which only the ext workflows load, to the caller", () => {
    // A required dependency would install a native binary for every caller,
    // including the ones on runtimes that cannot load it.
    expect(packageJson.peerDependencies?.["lkrequest-js"]).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.["lkrequest-js"]?.optional).toBe(true);
  });

  it("declares the Node floor `require(esm)` needs", () => {
    // Node below 22.12 cannot require an ESM module, which the CJS half of this
    // package depends on.
    expect(packageJson.engines.node).toBe(">=22.12");
  });

  it("points both module systems at their own entry and their own types", () => {
    // One .d.ts serving both resolution modes is the classic way a dual-format
    // package breaks, and is exactly what attw checks.
    expect(packageJson.exports["."]).toEqual({
      import: { types: "./dist/index.d.ts", default: "./dist/index.js" },
      require: { types: "./dist/index.d.cts", default: "./dist/index.cjs" },
    });
    expect(packageJson.exports["./ext"]).toEqual({
      import: { types: "./dist/ext/index.d.ts", default: "./dist/ext/index.js" },
      require: { types: "./dist/ext/index.d.cts", default: "./dist/ext/index.cjs" },
    });
  });

  it("ships the build output and the documentation, and nothing else", () => {
    expect(packageJson.files).toContain("dist");
    expect(packageJson.files).not.toContain("src");
    expect(packageJson.files).not.toContain("tests");
  });
});

describe("the public API surface", () => {
  it("exports the client, the error helpers and the task-type catalogue", () => {
    for (const name of [
      "EzCapSolverClient",
      "EzCaptchaError",
      "ApiError",
      "TransportError",
      "PollingExhaustedError",
      "WaitInterruptedError",
      "UnexpectedResponseError",
      "SolutionDecodeError",
      "taskIdOf",
      "isEzCaptchaError",
      "KNOWN_TASK_TYPES",
      "consoleLogger",
      "SDK_VERSION",
    ]) {
      expect(publicApi, name).toHaveProperty(name);
    }
  });

  it("keeps internals off the public surface", () => {
    // These are implementation details: exporting one is a promise not to change it.
    for (const name of [
      "decodeSolution",
      "taskParams",
      "postJson",
      "parseEnvelope",
      "resolveConfig",
    ]) {
      expect(publicApi, name).not.toHaveProperty(name);
    }
  });
});

describe("the ext entry", () => {
  it("exports the workflows and their error helpers", () => {
    for (const name of [
      "solveDataDomeWorkflow",
      "DataDomeError",
      "BrowserRequestError",
      "isDataDomeError",
      "isBrowserRequestError",
    ]) {
      expect(extApi, name).toHaveProperty(name);
    }
  });

  it("keeps the main entry free of the workflows", () => {
    expect(publicApi).not.toHaveProperty("solveDataDomeWorkflow");
  });
});
