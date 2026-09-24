/**
 * Solve a reCAPTCHA v3 Enterprise challenge, requiring a score of 0.9 or above.
 *
 * Task type: `ReCaptchaV3EnterpriseTaskProxylessS9`
 *
 * The task catalog writes this one as `RecaptchaV3EnterpriseTaskProxylessS9`.
 * The SDK normalises it to match the rest of the ReCaptcha family; the service
 * matches task types case-insensitively, so both reach the same worker.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v3
 *
 * Run: node --experimental-strip-types examples/recaptcha-v3/recaptcha-v3-enterprise-task-proxyless-s9.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

const solved = await client.solveReCaptchaV3EnterpriseTaskProxylessS9({
  websiteURL: "https://example.com",
  websiteKey: "your_enterprise_site_key",
  pageAction: "examples/v3scores",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`User-Agent: ${solved.solution.user_agent ?? "-"}`);
console.log(`Token:      ${solved.solution.gRecaptchaResponse.slice(0, 64)}...`);
console.log(`Balance:    ${await client.getBalance()}`);
