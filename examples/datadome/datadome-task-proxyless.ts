/**
 * Clear a DataDome challenge, both steps.
 *
 * Task type: `DataDomeTaskProxyless`
 *
 * Step one finds out where the challenge lives; step two produces the validation
 * instructions. Both decode into the same solution model.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api
 *
 * Run: node --experimental-strip-types examples/datadome/datadome-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const CHALLENGE_HTML_B64 = "base64_encoded_challenge_html";

const client = new EzCapSolverClient();

// Step one: find out where the challenge lives.
const first = await client.syncSolveDataDomeTaskProxyless({
  html_b64: CHALLENGE_HTML_B64,
  step: "1",
  referer: "https://example.com",
});
console.log(`Kind:       ${first.solution.kind ?? "-"}`);
console.log(`Challenge:  ${first.solution.url ?? "-"}`);

// Fetch that page, capture the slider image, then ask for the validation
// instructions.
const second = await client.syncSolveDataDomeTaskProxyless({
  html_b64: CHALLENGE_HTML_B64,
  step: "2",
  image: "base64_encoded_slider_image",
  referer: first.solution.url,
});
console.log(`Validate:   ${second.solution.url ?? "-"}`);
console.log(`Body:       ${second.solution.body ?? "-"}`);
console.log(`Balance:    ${await client.getBalance()}`);
