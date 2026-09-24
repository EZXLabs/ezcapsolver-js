/**
 * Solve a Cloudflare Turnstile widget.
 *
 * Task type: `CloudFlareTurnstileTask`
 *
 *
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/turnstile
 *
 * Run: node --experimental-strip-types examples/cloudflare/cloud-flare-turnstile-task.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

const solved = await client.solveCloudFlareTurnstileTask({
  websiteURL: "https://example.com",
  // Turnstile site keys start with 0x.
  websiteKey: "0x4AAAAAAA...",
  proxy: process.env["EZCAPTCHA_PROXY"],
  // Some widgets embed metadata the worker needs; pass it through when the
  // page renders one.
  rqData: undefined,
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`Token:      ${solved.solution.token.slice(0, 64)}...`);
for (const [name, value] of Object.entries(solved.solution.header ?? {})) {
  console.log(`Header:     ${name}: ${value}`);
}
console.log(`Balance:    ${await client.getBalance()}`);
