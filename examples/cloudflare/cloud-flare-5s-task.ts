/**
 * Clear the Cloudflare five-second challenge.
 *
 * Task type: `CloudFlare5STask`
 *
 * There is no single token here. Replaying the headers and cookies against the
 * protected site is what actually clears the challenge, which is why the whole
 * browser state comes back rather than one string.
 *
 * `proxy` is required for this type, unlike most others, and the replay has to go
 * through the same proxy the worker used or the clearance is rejected.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/cloudflare-5s
 *
 * Run: node --experimental-strip-types examples/cloudflare/cloud-flare-5s-task.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const TARGET = "https://example.com";
const PROXY = process.env["EZCAPTCHA_PROXY"];
if (PROXY === undefined) throw new Error("set EZCAPTCHA_PROXY to run this example");

const client = new EzCapSolverClient();

const solved = await client.solveCloudFlare5STask({
  websiteURL: TARGET,
  proxy: PROXY,
});

const { solution } = solved;
console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`TLS:        ${solution.tlsVersion ?? "-"}`);
for (const [name, value] of Object.entries(solution.header ?? {})) {
  console.log(`Header:     ${name}: ${value}`);
}
for (const [name, value] of Object.entries(solution.cookies ?? {})) {
  console.log(`Cookie:     ${name}=${value}`);
}

// Replaying the state is the step that actually clears the challenge. Send it
// through the same proxy the worker used — see README.zh-CN.md for wiring a
// proxy into fetch with undici.
const cookie = Object.entries(solution.cookies ?? {})
  .map(([name, value]) => `${name}=${value}`)
  .join("; ");
const replayed = await fetch(TARGET, {
  headers: { ...solution.header, ...(cookie ? { cookie } : {}) },
});
console.log(`Replayed:   HTTP ${replayed.status}`);
console.log(`Balance:    ${await client.getBalance()}`);
