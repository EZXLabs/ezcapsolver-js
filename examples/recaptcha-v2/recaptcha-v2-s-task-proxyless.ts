/**
 * Solve a reCAPTCHA v2 challenge that carries the `s` parameter.
 *
 * Task type: `ReCaptchaV2STaskProxyless`
 *
 * The `s` parameter routes the task to the high-score IPv4 queue. Despite the
 * type name it is not mandatory — send it when the page produces one.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v2
 *
 * Run: node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-s-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

// With no key passed, the client reads EZCAPTCHA_API_KEY from the environment.
const client = new EzCapSolverClient();

// Creates the task, then polls until the worker finishes it.
const solved = await client.solveReCaptchaV2STaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "your_site_key",
  s: "the_s_parameter_from_the_page",
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`User-Agent: ${solved.solution.user_agent ?? "-"}`);
console.log(`Token:      ${solved.solution.gRecaptchaResponse.slice(0, 64)}...`);
console.log(`Balance:    ${await client.getBalance()}`);
