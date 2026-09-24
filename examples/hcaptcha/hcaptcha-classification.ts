/**
 * Classify an hCaptcha challenge image.
 *
 * Task type: `HCaptchaClassification`
 *
 * This type's solution shape is not confirmed yet, so the model declares no
 * fields.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/hcaptcha
 *
 * Run: node --experimental-strip-types examples/hcaptcha/hcaptcha-classification.ts
 * (Node 23.6 and later need no flag.)
 */

import { readFile } from "node:fs/promises";

import { EzCapSolverClient } from "ezcapsolver-js";

const image = await readFile(new URL("../fixtures/crosswalks1x1.jpg", import.meta.url), {
  encoding: "base64",
});

const client = new EzCapSolverClient();

const solved = await client.syncSolveHCaptchaClassification({
  // A grid module would send `images` and `anchors` instead.
  image,
  question: "Please click each image containing a crosswalk",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Solution:   ${JSON.stringify(solved.solution)}`);
console.log(`Balance:    ${await client.getBalance()}`);
