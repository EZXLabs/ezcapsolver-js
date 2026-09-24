/**
 * Generate a DataDome tags payload.
 *
 * Task type: `DataDomeTagsTaskProxyless`
 *
 *
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api
 *
 * Run: node --experimental-strip-types examples/datadome/datadome-tags-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

const solved = await client.syncSolveDataDomeTagsTaskProxyless({
  // DataDome JavaScript key, read from the tags script tag.
  ddk: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  jstype: "ch",
  // Session identifier. An empty string is valid on first contact.
  cid: "",
  // One-based packet counter; increment it on every send.
  bpc: 1,
  referer: "https://example.com",
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // External business fields forwarded to the worker verbatim.
  fields: {},
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Endpoint:   ${solved.solution.url ?? "-"}`);
console.log(`Body:       ${solved.solution.body ?? "-"}`);
console.log(`Balance:    ${await client.getBalance()}`);
