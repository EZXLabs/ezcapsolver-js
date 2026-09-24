import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { EzCapSolverClient } from "../src/client.js";
import { isTransportError } from "../src/errors.js";
import { sleep } from "../src/transport.js";

/**
 * These go through a real socket rather than a fake fetch.
 *
 * A timeout, an abort and a refused connection are exactly the paths a stubbed
 * `fetch` cannot reproduce faithfully: what matters is how the platform
 * rejects, and whether the SDK turns that rejection into something readable.
 */

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

/** Starts a local server and returns its base URL. */
async function serve(handler: (respond: (body: string) => void) => void): Promise<string> {
  const server = createServer((_request, response) => {
    handler((body) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(body);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/** A port nothing is listening on, for the connection-refused case. */
async function deadPort(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}

describe("timeouts", () => {
  it("gives up on a server that never answers, and says how long it waited", async () => {
    // Never answers: the handle is dropped and the connection just hangs.
    const base = await serve(() => {});
    const client = new EzCapSolverClient({
      clientKey: "k",
      asyncBaseUrl: base,
      timeout: 60,
    });

    const error = await client.getBalance().catch((e: unknown) => e);

    expect(isTransportError(error)).toBe(true);
    expect(String(error)).toContain("timed out after 60ms");
  });

  it("bounds the synchronous endpoint separately from the asynchronous one", async () => {
    const base = await serve(() => {});
    const client = new EzCapSolverClient({
      clientKey: "k",
      asyncBaseUrl: base,
      syncBaseUrl: base,
      // The synchronous endpoint waits on a worker, so its budget has to be
      // a separate one.
      timeout: 10_000,
      syncTimeout: 60,
    });

    const started = Date.now();
    const error = await client
      .syncSolve({ type: "TlsTask", tls_type: "c", proxy: "p", url: "u" })
      .catch((e: unknown) => e);

    expect(String(error)).toContain("timed out after 60ms");
    // syncTimeout was used, not the ten-second one.
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

describe("cancellation", () => {
  it("tells a caller's abort apart from a timeout", async () => {
    const base = await serve(() => {});
    const client = new EzCapSolverClient({ clientKey: "k", asyncBaseUrl: base, timeout: 10_000 });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    const error = await client.getBalance({ signal: controller.signal }).catch((e: unknown) => e);

    expect(isTransportError(error)).toBe(true);
    // AbortSignal.timeout aborts with TimeoutError and abort() with AbortError,
    // which is what keeps the two tellable apart.
    expect(String(error)).toContain("aborted by the caller");
    expect(String(error)).not.toContain("timed out");
  });

  it("stops a wait that is between two polls", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const error = await sleep(10_000, controller.signal, "waiting for task t").catch(
      (e: unknown) => e,
    );

    expect(isTransportError(error)).toBe(true);
    expect(String(error)).toContain("waiting for task t");
  });

  it("does not start a wait whose signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const started = Date.now();
    const error = await sleep(10_000, controller.signal, "waiting").catch((e: unknown) => e);

    expect(isTransportError(error)).toBe(true);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("resolves normally when nothing cancels it", async () => {
    await expect(sleep(1, undefined, "waiting")).resolves.toBeUndefined();
  });

  it("abandons polling as soon as the caller aborts", async () => {
    let calls = 0;
    const base = await serve((respond) => {
      calls += 1;
      respond(JSON.stringify({ errorId: 0, status: "processing" }));
    });
    const client = new EzCapSolverClient({
      clientKey: "k",
      asyncBaseUrl: base,
      polling: { interval: 20, maxAttempts: 100 },
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 60);
    const error = await client
      .waitForResult("task-1", { signal: controller.signal })
      .catch((e: unknown) => e);

    expect(isTransportError(error)).toBe(true);
    // The budget of 100 attempts was not run to the end.
    expect(calls).toBeLessThan(10);
  });
});

describe("a request that never reaches the service", () => {
  it("reports the real reason rather than `fetch failed`", async () => {
    const base = await deadPort();
    const client = new EzCapSolverClient({ clientKey: "k", asyncBaseUrl: base, timeout: 5_000 });

    const error = await client.getBalance().catch((e: unknown) => e);

    expect(isTransportError(error)).toBe(true);
    // fetch gives only "fetch failed" on top, with the real reason in cause.
    expect(String(error)).not.toContain("fetch failed");
    expect(String(error)).toMatch(/ECONNREFUSED|connect/i);
  });

  it("names the operation it was attempting, without leaking the key", async () => {
    const base = await deadPort();
    const client = new EzCapSolverClient({
      clientKey: "super-secret-key",
      asyncBaseUrl: base,
      timeout: 5_000,
    });

    const error = await client.getBalance().catch((e: unknown) => e);

    if (!isTransportError(error)) throw new Error("unreachable");
    expect(error.op).toBe(`POST ${base}/getBalance`);
    expect(JSON.stringify(error.message)).not.toContain("super-secret-key");
  });
});

describe("the wire", () => {
  it("sends the headers the service expects", async () => {
    let seen: Record<string, string | string[] | undefined> = {};
    const server = createServer((request, response) => {
      seen = request.headers;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ errorId: 0, balance: 1 }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    const client = new EzCapSolverClient({
      clientKey: "k",
      asyncBaseUrl: `http://127.0.0.1:${port}`,
      userAgent: "test-agent/9",
    });
    await client.getBalance();

    expect(seen["content-type"]).toBe("application/json");
    expect(seen["user-agent"]).toBe("test-agent/9");
    expect(seen["x-api-key"]).toBe("k");
    expect(seen["x-request-id"]).toBeUndefined();
  });
});
