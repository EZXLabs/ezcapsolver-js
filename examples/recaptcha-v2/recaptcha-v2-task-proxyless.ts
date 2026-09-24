/**
 * Solve a reCAPTCHA v2 challenge.
 *
 * Task type: `ReCaptchaV2TaskProxyless`
 *
 * The site below is Google's own reCAPTCHA demo page, so this example runs as
 * written once `EZCAPTCHA_API_KEY` is set.
 *
 * `syncSolveReCaptchaV2TaskProxyless` runs the same task on the service's
 * synchronous endpoint. It returns a promise too — `sync` names the endpoint, not
 * the calling convention.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v2
 *
 * Run: node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

// With no key passed, the client reads EZCAPTCHA_API_KEY from the environment.
const client = new EzCapSolverClient();

// Creates the task, then polls until the worker finishes it.
const solved = await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://www.google.com/recaptcha/api2/demo",
  websiteKey: "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`User-Agent: ${solved.solution.user_agent ?? "-"}`);
console.log(`Token:      ${solved.solution.gRecaptchaResponse.slice(0, 64)}...`);
console.log(`Balance:    ${await client.getBalance()}`);
