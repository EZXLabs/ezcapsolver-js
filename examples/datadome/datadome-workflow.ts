/**
 * Clear a DataDome challenge in one call and get the cookie it issues.
 *
 * Task type: `DataDomeTaskProxyless`, steps one to three, run inside the call.
 *
 * The call fetches the page, locates and loads the challenge, reads its
 * script, asks the service for the answer, and submits it. Browser-side
 * requests go through the proxy with the Chrome TLS fingerprint the user agent
 * names, so keep using both for the requests that carry the cookie.
 *
 * Needs the optional `lkrequest-js` package: `npm install lkrequest-js`.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api
 *
 * Run: EZCAPTCHA_PROXY=http://user:pass@host:port \
 *   node --experimental-strip-types examples/datadome/datadome-workflow.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";
import { solveDataDomeWorkflow } from "ezcapsolver-js/ext";

const client = new EzCapSolverClient({ clientKey: "YOUR_API_KEY" });

const cookie = await solveDataDomeWorkflow(client, {
  targetUrl: "https://example.com/signup",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
  proxy: process.env["EZCAPTCHA_PROXY"],
});

if (cookie === undefined) {
  console.log("DataDome did not intercept the page");
} else {
  console.log(`Cookie:   ${cookie.name}=${cookie.value}`);
  console.log(`Domain:   ${cookie.domain}`);
}
console.log(`Balance:  ${await client.getBalance()}`);
