/**
 * Run the Akamai Web sensor handshake.
 *
 * Task type: `AkamaiWEBTaskProxyless`
 *
 * A multi-round flow: each round feeds the previous round's `encodedata` back in
 * as `encodeData` and increments `index`. The round that ends the flow returns no
 * further state.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/akamai-web
 *
 * Run: node --experimental-strip-types examples/akamai/akamai-web-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const MAX_ROUNDS = 5;

const client = new EzCapSolverClient();

// The first round sends no encoded state.
let encodeData = "";

for (let index = 0; index < MAX_ROUNDS; index++) {
  const solved = await client.syncSolveAkamaiWEBTaskProxyless({
    pageUrl: "https://example.com",
    // Most sites change this URL on every request, so read it from the page
    // rather than hard-coding it.
    v3Url: "https://example.com/v3/...",
    // Chrome only. `lang` has to match both the accept-language header sent to
    // the site and the region the proxy exits from.
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    lang: "en-GB",
    index,
    abck: "_abck_cookie_value",
    bmsz: "bm_sz_cookie_value",
    // Read from network traffic, then base64-encoded. Only the first round
    // sends it; later rounds send an empty string.
    script_base64: index === 0 ? "base64_encoded_v3_script" : "",
    encodeData,
  });

  const { solution } = solved;
  console.log(`Round ${index}:    payload ${solution.payload.length} bytes`);

  // POST `payload` to v3Url, read the new _abck cookie from that response, and
  // carry the encoded state into the next round.
  encodeData = solution.encodedata ?? "";
  if (encodeData === "") {
    console.log("Finished:   the flow returned no further state");
    break;
  }
}

console.log(`Balance:    ${await client.getBalance()}`);
