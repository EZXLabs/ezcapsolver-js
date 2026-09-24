/**
 * Forward one HTTP request through the worker's TLS fingerprint.
 *
 * Task type: `TlsTask`
 *
 * The worker performs the request with a browser's TLS fingerprint and hands back
 * the upstream response verbatim.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/tls-forward
 *
 * Run: node --experimental-strip-types examples/tls-forward/tls-task.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const PROXY = process.env["EZCAPTCHA_PROXY"];
if (PROXY === undefined) throw new Error("set EZCAPTCHA_PROXY to run this example");

const client = new EzCapSolverClient();

const solved = await client.syncSolveTlsTask({
  // Browser fingerprint the worker should present.
  tls_type: "chrome146",
  proxy: PROXY,
  method: "GET",
  url: "https://postman-echo.com/get",
});

const { solution } = solved;
console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Upstream:   HTTP ${solution.code ?? "-"}`);
for (const [name, value] of Object.entries(solution.headers ?? {})) {
  console.log(`Header:     ${name}: ${JSON.stringify(value)}`);
}
console.log(`Body:       ${(solution.body ?? "").slice(0, 200)}`);
console.log(`Balance:    ${await client.getBalance()}`);
