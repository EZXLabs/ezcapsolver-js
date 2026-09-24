/**
 * Drive the task workflow by hand, and reach task types the SDK does not know.
 *
 * The named methods do all of this in one call. Take it apart when you need to
 * persist the task id, poll on your own schedule, or use a task type the
 * service ships before the SDK models it.
 *
 * Run: node --experimental-strip-types examples/raw-usage.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient, taskIdOf } from "ezcapsolver-js";

const client = new EzCapSolverClient();

// --- 1. The workflow, step by step ------------------------------------------
//
// `createTask` is the billed call. Everything after it is free, so persist the
// id before doing anything that might fail: the service holds a result for
// five minutes, and a replacement task is billed again.

const taskId = await client.createTask({
  type: "ReCaptchaV2TaskProxyless",
  websiteURL: "https://www.google.com/recaptcha/api2/demo",
  websiteKey: "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
});
console.log(`Created:    ${taskId}`);

// One query, no waiting. `status` narrows the result: on "ready" the solution
// is guaranteed present, so there is no predicate to call first.
const once = await client.getTaskResult(taskId);
console.log(`Status:     ${once.status}`);
if (once.status === "ready") {
  console.log(`Solution:   ${JSON.stringify(once.solution)}`);
}

// Or poll until it finishes, with settings for this call only.
const result = await client.waitForResult(taskId, {
  polling: { interval: 2_000, maxAttempts: 30 },
});
console.log(`Settled:    ${result.status}`);

// --- 2. A task type this release does not model -----------------------------
//
// The generic form takes any type string with any parameters, so a type the
// service ships today is usable without waiting for an SDK release. The
// solution comes back as an open object rather than a typed model.

const experimental = await client.solve({
  type: "SomeBrandNewTaskType",
  websiteURL: "https://example.com",
  whateverTheDocsSay: 42,
});
console.log(`Fields:     ${Object.keys(experimental.solution).join(", ")}`);
console.log(`Raw:        ${JSON.stringify(experimental.raw)}`);

// The synchronous endpoint takes the same shape.
const experimentalSync = await client.syncSolve({
  type: "SomeBrandNewSyncType",
  image: "base64_encoded_image",
});
console.log(`Raw:        ${JSON.stringify(experimentalSync.raw)}`);

// --- 3. Recovering a billed task --------------------------------------------
//
// If a solve fails after the task was created, the id is on the error. This is
// the one place to ask for it, whichever error type carries it.

try {
  await client.solveReCaptchaV2TaskProxyless({
    websiteURL: "https://example.com",
    websiteKey: "6Lc-key",
  });
} catch (error) {
  const billed = taskIdOf(error);
  if (billed !== undefined) {
    console.log(`Recovering: ${billed}`);
    const recovered = await client.waitForResult(billed);
    console.log(`Recovered:  ${recovered.status}`);
  }
}

console.log(`Balance:    ${await client.getBalance()}`);
