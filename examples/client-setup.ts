/**
 * Build a client with every option set, and route its traffic through a proxy.
 *
 * Nothing here is required — `new EzCapSolverClient()` with `EZCAPTCHA_API_KEY`
 * in the environment is enough. This shows what can be changed and what each
 * setting costs.
 *
 * Run: node --experimental-strip-types examples/client-setup.ts
 * (Node 23.6 and later need no flag.)
 */

import { consoleLogger, EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient({
  // Falls back to EZCAPTCHA_API_KEY, which is the only value read implicitly.
  clientKey: process.env["EZCAPTCHA_API_KEY"],

  // The service splits its two deployments, so these cannot share one host.
  // Override them for a self-hosted deployment or a local test server.
  asyncBaseUrl: "https://api.ez-captcha.com",
  syncBaseUrl: "https://sync.ez-captcha.com",

  // Two separate budgets, in milliseconds. Do not merge them: an asynchronous
  // call only enqueues a task and should fail fast, while a synchronous call
  // blocks until a worker answers and the service allows its slowest types 180
  // seconds. One shared value would either cut the slow path short or make a
  // network fault take minutes to surface.
  timeout: 30_000,
  syncTimeout: 240_000,

  // Applied before every result query, the first one included: a task that was
  // just created is still queued, so querying immediately only reports
  // processing. 3s x 50 puts the ceiling at two and a half minutes.
  polling: { interval: 3_000, maxAttempts: 50 },

  // Optional developer application identifier.
  appId: undefined,

  userAgent: `my-app/1.0 (+https://example.com)`,

  // Without a logger, logging is discarded. `trace` carries full request and
  // response bodies with credentials redacted at any nesting depth; nothing is
  // rendered below that level, so leaving it off costs nothing.
  logger: consoleLogger("debug"),
});

console.log(client.config);
console.log(`Balance:    ${await client.getBalance()}`);

// --- Sending through a proxy -----------------------------------------------
//
// This is the one place the JavaScript SDK differs from the Rust, Go and
// Python ones: there is no `proxy` option, because a proxy needs a dispatcher
// and only Node's `undici` supplies one. Rather than depend on it — which
// would rule out Deno, Bun and Cloudflare Workers — the SDK takes a `fetch`.
//
// Install undici yourself, then:
//
//     import { ProxyAgent } from "undici";
//
//     const dispatcher = new ProxyAgent("http://user:pass@proxy.example:8080");
//     const proxied = new EzCapSolverClient({
//       fetch: (url, init) => fetch(url, { ...init, dispatcher } as RequestInit),
//     });
//
// Node's global `fetch` honours `init.dispatcher`, so `undici.fetch` is not
// needed — only the agent. The same seam takes a tuned connection pool, or a
// stub in tests.
//
// Note this is the SDK's *own* outbound proxy. It is unrelated to the `proxy`
// parameter on a task, which is what the worker uses to reach the protected
// site.
