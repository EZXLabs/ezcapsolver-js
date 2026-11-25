/**
 * Clear a DataDome challenge step by step.
 *
 * Task type: `DataDomeTaskProxyless`
 *
 * The three steps share one request and one solution model, and all run
 * through the synchronous endpoint. Between them you fetch the pages yourself:
 *
 * 1. Step one turns the intercepted page into the challenge address in `url`.
 * 2. Fetch that page and its challenge script, then ask step two whether the
 *    service already caches the script, by its hash.
 * 3. Step three returns the submission in `url` and `body`, and how long to
 *    wait before sending it in `submit_after_ms`. Submitting it from the
 *    challenge page brings back the cookie.
 *
 * `referer` is what the service checks a site allow-list against, so leave it
 * set even though the parameter is not formally required.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api
 *
 * Run: node --experimental-strip-types examples/datadome/datadome-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

/** The browser the pages were fetched with. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
/** The page DataDome intercepted, captured and base64-encoded. */
const INTERCEPTED_HTML_B64 = "base64_encoded_intercepted_page";
/** The challenge page step one points at, captured and base64-encoded. */
const CHALLENGE_HTML_B64 = "base64_encoded_challenge_page";
/** MD5 of the challenge script without its first-line version banner. */
const SCRIPT_HASH = "md5_of_the_challenge_script";
/** The challenge script itself, base64-encoded. */
const SCRIPT_B64 = "base64_encoded_challenge_script";

const client = new EzCapSolverClient({ clientKey: "YOUR_API_KEY" });

// Step one: find out where the challenge lives.
const first = await client.syncSolveDataDomeTaskProxyless({
  step: "1",
  html_b64: INTERCEPTED_HTML_B64,
  referer: "https://example.com",
  user_agent: USER_AGENT,
});
console.log(`Challenge:  ${first.solution.url ?? "-"}`);

// Fetch that page and its script, then ask whether the service caches it.
const second = await client.syncSolveDataDomeTaskProxyless({ step: "2", hash: SCRIPT_HASH });
const cached = second.solution.status ?? false;
console.log(`Cached:     ${cached}`);

// Step three: the submission. A cached script only needs its hash.
const third = await client.syncSolveDataDomeTaskProxyless({
  step: "3",
  html_b64: CHALLENGE_HTML_B64,
  referer: first.solution.url,
  user_agent: USER_AGENT,
  ...(cached ? { external_js_hash: SCRIPT_HASH } : { external_js_base64: SCRIPT_B64 }),
});
console.log(`Kind:       ${third.solution.kind ?? "-"}`);
console.log(`Submit to:  ${third.solution.url ?? "-"}`);
console.log(`Body:       ${third.solution.body ?? "-"}`);
console.log(`Wait (ms):  ${third.solution.submit_after_ms ?? 0}`);
console.log(`Balance:    ${await client.getBalance()}`);
