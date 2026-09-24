/**
 * Classify a reCAPTCHA v2 image grid.
 *
 * Task type: `ReCaptchaV2Classification`
 *
 * A single image asking about crosswalks, which the worker answers with a yes or
 * no. The 3x3 and 4x4 fixtures sit alongside it; those return the indexes of the
 * cells to click instead, so pass a matching `size`.
 *
 * This type runs on the synchronous endpoint, which answers on the creating
 * request rather than handing back a task to poll.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v2
 *
 * Run: node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-classification.ts
 * (Node 23.6 and later need no flag.)
 */

import { readFile } from "node:fs/promises";

import { EzCapSolverClient, isMultiClassification, isSingleClassification } from "ezcapsolver-js";

const image = await readFile(new URL("../fixtures/crosswalks1x1.jpg", import.meta.url), {
  encoding: "base64",
});

const client = new EzCapSolverClient();

const solved = await client.syncSolveReCaptchaV2Classification({
  image,
  // Google object identifier; /m/014xcs is "crosswalk".
  question: "/m/014xcs",
  size: 1,
});

const { solution } = solved;
console.log(`Request ID: ${solved.requestId ?? "-"}`);
if (isMultiClassification(solution)) {
  console.log(`Cells:      ${solution.objects}`);
} else if (isSingleClassification(solution)) {
  console.log(`Has object: ${solution.hasObject}`);
} else {
  console.log(`Type:       ${solution.type ?? "-"}`);
  console.log(`Raw:        ${JSON.stringify(solved.raw)}`);
}

console.log(`Balance:    ${await client.getBalance()}`);
