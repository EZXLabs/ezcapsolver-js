/**
 * Solve a reCAPTCHA v2 Enterprise challenge that carries the `s` parameter.
 *
 * Task type: `ReCaptchaV2SEnterpriseTaskProxyless`
 *
 *
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v2
 *
 * Run: node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-s-enterprise-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

// With no key passed, the client reads EZCAPTCHA_API_KEY from the environment.
const client = new EzCapSolverClient();

// Creates the task, then polls until the worker finishes it.
const solved = await client.solveReCaptchaV2SEnterpriseTaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "your_enterprise_site_key",
  s: "the_s_parameter_from_the_page",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`User-Agent: ${solved.solution.user_agent ?? "-"}`);
console.log(`Token:      ${solved.solution.gRecaptchaResponse.slice(0, 64)}...`);
console.log(`Balance:    ${await client.getBalance()}`);
