/**
 * Workflows that run the whole flow around a task type in one call: fetching
 * the protected pages, chaining the steps of the task, and submitting the
 * answer.
 *
 * Each workflow is a function named `solve<X>Workflow` that takes the
 * `EzCapSolverClient` its API calls go through:
 *
 * ```ts
 * import { EzCapSolverClient } from "ezcapsolver-js";
 * import { solveDataDomeWorkflow } from "ezcapsolver-js/ext";
 *
 * const client = new EzCapSolverClient({ clientKey: "YOUR_API_KEY" });
 * const cookie = await solveDataDomeWorkflow(client, {
 *   targetUrl: "https://example.com/signup",
 *   userAgent,
 *   proxy: "http://user:pass@host:port",
 * });
 * ```
 *
 * The browser side of a workflow runs on `lkrequest-js`, a Node.js HTTP client
 * with browser TLS fingerprints. It is an optional peer dependency, so install
 * it alongside this package to use a workflow: `npm install lkrequest-js`.
 * The main `ezcapsolver-js` entry does not load it.
 *
 * @module
 */

export type { DataDomeChallenge, DataDomeCookie } from "./datadome/types.js";
export { solveDataDomeWorkflow } from "./datadome/workflow.js";
export {
  BrowserRequestError,
  DataDomeError,
  isBrowserRequestError,
  isDataDomeError,
} from "./errors.js";
