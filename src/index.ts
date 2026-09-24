/**
 * JavaScript/TypeScript SDK for the EzCaptchaSolver task API.
 *
 * ```ts
 * import { EzCapSolverClient } from "ezcapsolver-js";
 *
 * const client = new EzCapSolverClient({ clientKey: "..." });
 * const solved = await client.solve({
 *   type: "ReCaptchaV2TaskProxyless",
 *   websiteURL: "https://example.com",
 *   websiteKey: "6Lc...",
 * });
 * console.log(solved.solution.gRecaptchaResponse);
 * ```
 *
 * The client key falls back to the `EZCAPTCHA_API_KEY` environment variable.
 *
 * # Errors
 *
 * Every failure is an {@link EzCaptchaError} carrying a `kind` that says which
 * layer it belongs to. Narrow with {@link isApiError} and friends rather than
 * `instanceof` — a package published in both ESM and CJS can be loaded twice,
 * and `instanceof` does not survive that.
 *
 * A failure raised while waiting for a task that was already created and
 * billed arrives as a {@link WaitInterruptedError} carrying the task
 * identifier. {@link taskIdOf} is the one place to ask for it, whichever error
 * type happens to hold it — recover by waiting on the same task rather than
 * paying for a second one.
 *
 * This SDK does not retry a request for the caller. Creating a task is billed
 * and is not idempotent, and the service temporarily bans a key that repeats
 * certain credential errors, so the retry policy belongs to the caller.
 * {@link ApiError.isTerminal}, {@link ApiError.isAuthenticationError} and
 * {@link ApiError.isRateLimited} provide the facts needed to decide.
 *
 * The one exception is a throttled poll: `ERROR_REQUEST_LIMIT` and
 * `ERROR_REQUEST_BANNED` refuse the query rather than the task, which is still
 * queued and still billed, so `waitForResult` spends the attempt and asks
 * again. Every other error ends the wait.
 *
 * # Lossless results
 *
 * A solution keeps every field the worker returned. Anything this release does
 * not declare is still on the object — reach it with `solution["newField"]` —
 * and `solved.raw` keeps the untouched value.
 *
 * @module
 */

export type { CallOptions, SolveOptions } from "./client.js";
export { EzCapSolverClient } from "./client.js";
export type { ClientConfig, ClientOptions, PollingConfig } from "./config.js";
export {
  DEFAULT_ASYNC_BASE_URL,
  DEFAULT_CLIENT_KEY_ENV,
  DEFAULT_MAX_POLL_ATTEMPTS,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_SYNC_BASE_URL,
  DEFAULT_SYNC_TIMEOUT,
  DEFAULT_TIMEOUT,
  defaultPolling,
  SDK_VERSION,
} from "./config.js";
export type { ApiErrorFields, ErrorKind } from "./errors.js";
export {
  ApiError,
  EzCaptchaError,
  isApiError,
  isDecodeError,
  isEzCaptchaError,
  isPollingExhaustedError,
  isTransportError,
  isWaitInterruptedError,
  PollingExhaustedError,
  SolutionDecodeError,
  TransportError,
  taskIdOf,
  UnexpectedResponseError,
  WaitInterruptedError,
} from "./errors.js";
export type { LogFields, Logger, LogLevel, LogMethod } from "./logger.js";
export { consoleLogger, LOG_LEVELS } from "./logger.js";

export type {
  ErroredTaskResult,
  ProcessingTaskResult,
  ReadyTaskResult,
  Solved,
  TaskResult,
  TaskStatus,
} from "./responses.js";
export type {
  AkamaiSbsdSolution,
  AkamaiWebSolution,
  Cloudflare5sSolution,
  CloudflareTurnstileSolution,
  DataDomeSolution,
  FunCaptchaClassificationSolution,
  FunCaptchaSolution,
  HCaptchaClassificationSolution,
  HCaptchaSolution,
  IncapsulaSolution,
  PerimeterXSolution,
  ReClassificationSolution,
  RecaptchaSolution,
  SolutionByTaskType,
  SolutionFor,
  TlsForwardSolution,
  UnmodelledFields,
} from "./solutions.js";
export { isMultiClassification, isSingleClassification } from "./solutions.js";
export type { KnownTaskType, TaskMode, TaskType } from "./task-type.js";
export { isKnownTaskType, KNOWN_TASK_TYPES, taskMode } from "./task-type.js";

export type {
  AkamaiSbsdParams,
  AkamaiWebParams,
  Cloudflare5sParams,
  CloudflareTurnstileParams,
  DataDomeJsType,
  DataDomeParams,
  DataDomeStep,
  DataDomeTagsParams,
  FunCaptchaClassificationParams,
  FunCaptchaParams,
  HCaptchaClassificationParams,
  HCaptchaParams,
  IncapsulaParams,
  ParamsByTaskType,
  ParamsFor,
  PerimeterXParams,
  ReCaptchaV2ClassificationParams,
  ReCaptchaV2Params,
  ReCaptchaV3Params,
  Task,
  TaskExtra,
  TlsForwardParams,
  TlsHttpMethod,
  WithExtras,
} from "./tasks.js";
