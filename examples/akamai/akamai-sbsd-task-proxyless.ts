/**
 * Generate an Akamai SBSD payload.
 *
 * Task type: `AkamaiSBSDTaskProxyless`
 *
 *
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/akamai-sbsd
 *
 * Run: node --experimental-strip-types examples/akamai/akamai-sbsd-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

// Every value below is collected from the protected page before solving:
// `sbsdUrl` comes from its <script src="/sbsd/...?v=..."> tag, `script_base64`
// is that script base64-encoded, and `bmSo` is the bm_so cookie, falling back
// to sbsd_o.
const solved = await client.syncSolveAkamaiSBSDTaskProxyless({
  pageUrl: "https://example.com",
  sbsdUrl: "https://example.com/sbsd/xxxxx?v=xxx",
  bmSo: "bm_so_cookie_value",
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  lang: "en-US",
  script_base64: "base64_encoded_sbsd_script",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Payload:    ${solved.solution.payload.slice(0, 64)}...`);
console.log(`bm_lso_time:${solved.solution.bm_lso_time ?? "-"}`);

// Decode the payload from base64, then POST it as {"body": <decoded>} to the
// SBSD endpoint — that is `sbsdUrl` without its query string. Keep the cookies
// that response sets for every subsequent request.

console.log(`Balance:    ${await client.getBalance()}`);
