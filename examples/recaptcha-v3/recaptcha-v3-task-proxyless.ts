/**
 * Solve a reCAPTCHA v3 challenge.
 *
 * Task type: `ReCaptchaV3TaskProxyless`
 *
 * v3 grades silently rather than showing a challenge, so `pageAction` has to
 * match the action the protected page grades against.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v3
 *
 * Run: node --experimental-strip-types examples/recaptcha-v3/recaptcha-v3-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

const solved = await client.solveReCaptchaV3TaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "your_site_key",
  pageAction: "examples/v3scores",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`User-Agent: ${solved.solution.user_agent ?? "-"}`);
console.log(`Token:      ${solved.solution.gRecaptchaResponse.slice(0, 64)}...`);
console.log(`Balance:    ${await client.getBalance()}`);
