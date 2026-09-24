/**
 * Send parameters the SDK does not model, and read fields it does not declare.
 *
 * Workers change faster than this SDK does. Both directions are lossless, so a
 * parameter the service adds today is usable today, and a field a worker
 * starts returning is never dropped on the way to you — with or without an SDK
 * upgrade.
 *
 * Run: node --experimental-strip-types examples/custom-parameters.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

// --- Sending parameters this release does not model -------------------------
//
// Write them inline, next to the declared ones. There is no wrapper to reach
// for and no mapping table: the object you write is the `task` object that
// goes on the wire.

const solved = await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://www.google.com/recaptcha/api2/demo",
  websiteKey: "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",

  // Not declared by this release — forwarded to the worker untouched.
  someNewParameter: "whatever the docs say",
  aNumber: 42,
  anObject: { nested: true },
});

// The one thing inlining cannot do is change the task type. `type` is written
// last, so this is ignored rather than silently billing a different type:
//
//   await client.solveReCaptchaV2TaskProxyless({
//     websiteURL, websiteKey,
//     type: "SomethingElse",   // ignored
//   });

// `extra` does the same thing, for when keeping pass-through parameters
// visibly separate is worth the extra nesting. Both produce the same request.
await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://www.google.com/recaptcha/api2/demo",
  websiteKey: "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
  extra: { someNewParameter: "whatever the docs say" },
});

// Worth knowing about the inline form: accepting arbitrary keys means
// TypeScript stops flagging a misspelled *optional* one. `websiteUrl` below
// is not rejected — it is sent as a custom parameter. Required parameters and
// the types of declared ones are still checked.
//
//   await client.solveReCaptchaV2TaskProxyless({
//     websiteURL, websiteKey,
//     websiteUrl: "typo",   // sent, not flagged
//   });

// --- Reading fields this release does not declare ---------------------------
//
// There is no `extra` bucket on the way back. The solution object keeps every
// field the worker sent, so a declared field reads with a dot and an
// unmodelled one with a bracket. The bracket is the point: it marks a value
// the SDK makes no promises about.

const { solution } = solved;

console.log(`Token:      ${solution.gRecaptchaResponse.slice(0, 48)}...`);
console.log(`User-Agent: ${solution.user_agent ?? "-"}`);

// Unmodelled — typed `unknown`, so narrow it before use.
const contextId = solution["contextId"];
if (typeof contextId === "string") {
  console.log(`Context ID: ${contextId}`);
}

// Everything the worker returned, declared or not.
console.log("All fields the worker returned:");
for (const [name, value] of Object.entries(solution)) {
  console.log(`  ${name}: ${JSON.stringify(value)}`);
}

// `raw` is the untouched value the worker produced. The solution object is
// already lossless, so reach for this only when the exact bytes matter —
// reproducing a response, or diagnosing a shape this release does not model.
console.log(`Raw:        ${JSON.stringify(solved.raw)}`);

// --- Declaring a field the SDK has not caught up with ----------------------
//
// When a worker field is stable enough to rely on, describe it once and keep
// the checking. This is a local declaration, not a fork of the SDK, and it
// keeps working after the field is declared upstream.

interface RecaptchaWithContext {
  gRecaptchaResponse: string;
  contextId?: string;
}

const typed = solved.solution as RecaptchaWithContext;
console.log(`Context ID: ${typed.contextId ?? "-"}`);

console.log(`Balance:    ${await client.getBalance()}`);
