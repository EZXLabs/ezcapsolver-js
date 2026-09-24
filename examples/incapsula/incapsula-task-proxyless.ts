/**
 * Generate an Incapsula Reese84 sensor payload.
 *
 * Task type: `IncapsulaTaskProxyless`
 *
 * `data` comes back as stringified JSON and has to be submitted exactly as it
 * arrived — parsing it would change what the sensor endpoint receives, so the SDK
 * leaves it alone.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/incapsula
 *
 * Run: node --experimental-strip-types examples/incapsula/incapsula-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const SCRIPT = "full_source_of_the_reese84_sensor_script";

const client = new EzCapSolverClient();

const solved = await client.syncSolveIncapsulaTaskProxyless({
  script: SCRIPT,
  scriptUrl: "https://example.com/xxxxx?d=example.com",
  pageUrl: "https://example.com",
  // Must match the Accept-Language header of the browser flow.
  acceptLanguage: "en-US,en;q=0.9",
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  proxy: process.env["EZCAPTCHA_PROXY"],
  // Only the sites with PoW challenges enabled need this one.
  pow: process.env["EZCAPTCHA_INCAPSULA_POW"],
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Status:     ${solved.solution.status ?? "-"}`);
console.log(`Data:       ${solved.solution.data.slice(0, 64)}...`);
console.log(`Balance:    ${await client.getBalance()}`);
