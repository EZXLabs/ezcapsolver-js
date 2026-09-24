/**
 * Classify a FunCaptcha challenge image.
 *
 * Task type: `FunCaptchaClassification`
 *
 * This type's solution shape is not confirmed yet, so the model declares no
 * fields. Everything the worker returned is still on the object — read it with a
 * bracket, and `solved.raw` keeps the untouched value.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/funcaptcha
 *
 * Run: node --experimental-strip-types examples/funcaptcha/funcaptcha-classification.ts
 * (Node 23.6 and later need no flag.)
 */

import { readFile } from "node:fs/promises";

import { EzCapSolverClient } from "ezcapsolver-js";

const image = await readFile(new URL("../fixtures/crosswalks1x1.jpg", import.meta.url), {
  encoding: "base64",
});

const client = new EzCapSolverClient();

const solved = await client.syncSolveFunCaptchaClassification({
  image,
  // The instruction text shown above the challenge.
  question: "Pick the image that is the correct way up",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
for (const [name, value] of Object.entries(solved.solution)) {
  console.log(`  ${name}: ${JSON.stringify(value)}`);
}
console.log(`Raw:        ${JSON.stringify(solved.raw)}`);
console.log(`Balance:    ${await client.getBalance()}`);
