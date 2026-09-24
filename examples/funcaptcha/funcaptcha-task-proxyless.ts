/**
 * Solve a FunCaptcha (Arkose Labs) challenge.
 *
 * Task type: `FuncaptchaTaskProxyless`
 *
 * Note the wire spelling: the service names this type with a lowercase `c` in
 * `Funcaptcha`, unlike `FunCaptchaClassification`. The SDK sends it verbatim.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/funcaptcha
 *
 * Run: node --experimental-strip-types examples/funcaptcha/funcaptcha-task-proxyless.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

const solved = await client.solveFuncaptchaTaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "your_public_key",
  // Arkose Labs blob, passed as a JSON string like {"blob":"..."}.
  data: undefined,
  // Only when the site serves Arkose Labs from a custom subdomain.
  funcaptchaApiJSSubdomain: undefined,
  // FunCaptcha is the one type using the FUN proxy format,
  // protocol://host:port:username:password, rather than the usual
  // protocol://username:password@host:port. A rotating proxy has to support
  // sessions.
  proxy: process.env["EZCAPTCHA_PROXY"],
});

console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`Token:      ${solved.solution.token.slice(0, 64)}...`);
console.log(`Balance:    ${await client.getBalance()}`);
