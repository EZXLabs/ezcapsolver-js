/**
 * Solve an hCaptcha challenge.
 *
 * Task type: `HCaptcha`
 *
 * The site below is hCaptcha's own demo page, so this example runs as written
 * once `EZCAPTCHA_API_KEY` is set.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/hcaptcha
 *
 * Run: node --experimental-strip-types examples/hcaptcha/hcaptcha.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

const solved = await client.solveHCaptcha({
  websiteURL: "https://accounts.hcaptcha.com/demo",
  websiteKey: "a5f74b19-9e45-40e0-b45d-47ff91b7a6c2",
  lang: "en-US",
  proxy: process.env["EZCAPTCHA_PROXY"],
  // False because the demo page shows a checkbox. Sites that hide it need true.
  invisible: false,
  // Only the sites that publish an rqdata value need this one. Note the
  // lower-case spelling: Cloudflare's equivalent is `rqData`.
  rqdata: process.env["EZCAPTCHA_HCAPTCHA_RQDATA"],
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`Pass UUID:  ${solved.solution.generated_pass_UUID}`);
// Every request carrying the token must send this exact User-Agent.
console.log(`User-Agent: ${solved.solution.ua ?? "-"}`);
// Fields this release does not declare stay on the solution object.
console.log(`Context ID: ${solved.solution["contextId"] ?? "-"}`);
console.log(`Balance:    ${await client.getBalance()}`);
