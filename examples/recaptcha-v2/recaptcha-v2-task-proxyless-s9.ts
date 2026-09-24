/**
 * Solve a reCAPTCHA v2 challenge, requiring a score of 0.9 or above.
 *
 * Task type: `ReCaptchaV2TaskProxylessS9`
 *
 * The high-score queue costs more and takes longer, so reach for it only when
 * the protected site actually grades the token.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v2
 *
 * Run: node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-task-proxyless-s9.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

// With no key passed, the client reads EZCAPTCHA_API_KEY from the environment.
const client = new EzCapSolverClient();

// Creates the task, then polls until the worker finishes it.
const solved = await client.solveReCaptchaV2TaskProxylessS9({
  websiteURL: "https://example.com",
  websiteKey: "your_site_key",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`User-Agent: ${solved.solution.user_agent ?? "-"}`);
console.log(`Token:      ${solved.solution.gRecaptchaResponse.slice(0, 64)}...`);
console.log(`Balance:    ${await client.getBalance()}`);
