/**
 * The client.
 *
 * One instance covers every operation. There is no separate synchronous
 * client — JavaScript has no blocking I/O, so the split Python and Rust need
 * does not arise here. The `sync` in `syncSolve` is the *service's* endpoint,
 * not a blocking call.
 *
 * There is also no `close()`. Go needs one because it builds its own
 * `http.Transport` and owns the connection pool; `fetch` owns nothing this SDK
 * allocated, so there is nothing to release.
 *
 * @module
 */

import {
  type ClientConfig,
  type ClientOptions,
  type PollingConfig,
  type ResolvedConfig,
  resolveConfig,
  resolvePolling,
} from "./config.js";
import {
  ApiError,
  isEzCaptchaError,
  MISSING_SOLUTION_REASON,
  PollingExhaustedError,
  UnexpectedResponseError,
  WaitInterruptedError,
} from "./errors.js";
import type { ReadyTaskResult, Solved, TaskResult, TaskStatus } from "./responses.js";
import {
  type AkamaiSbsdSolution,
  type AkamaiWebSolution,
  type Cloudflare5sSolution,
  type CloudflareTurnstileSolution,
  type DataDomeSolution,
  decodeSolution,
  type FunCaptchaClassificationSolution,
  type FunCaptchaSolution,
  type HCaptchaClassificationSolution,
  type HCaptchaSolution,
  type IncapsulaSolution,
  type PerimeterXSolution,
  type ReClassificationSolution,
  type RecaptchaSolution,
  type SolutionFor,
  type TlsForwardSolution,
} from "./solutions.js";
import type { TaskType } from "./task-type.js";
import {
  type AkamaiSbsdParams,
  type AkamaiWebParams,
  type Cloudflare5sParams,
  type CloudflareTurnstileParams,
  type DataDomeParams,
  type DataDomeTagsParams,
  type FunCaptchaClassificationParams,
  type FunCaptchaParams,
  type HCaptchaClassificationParams,
  type HCaptchaParams,
  type IncapsulaParams,
  type ParamsFor,
  type PerimeterXParams,
  type ReCaptchaV2ClassificationParams,
  type ReCaptchaV2Params,
  type ReCaptchaV3Params,
  type Task,
  type TlsForwardParams,
  taskParams,
  type WithExtras,
} from "./tasks.js";
import { postJson, type RequestContext, sleep } from "./transport.js";
import {
  asString,
  balanceBody,
  createTaskBody,
  endpoint,
  PATH,
  preview,
  taskResultBody,
} from "./wire.js";

/** Options accepted by any single call. */
export interface CallOptions {
  /**
   * Cancels the call. Merged with the client's timeout, so whichever fires
   * first wins.
   */
  signal?: AbortSignal | undefined;
}

/** Options accepted by a call that waits for a task. */
export interface SolveOptions extends CallOptions {
  /**
   * Polling settings for this call only.
   *
   * Task types differ widely in how long they take, so a single client-wide
   * budget does not fit every one of them.
   */
  polling?: Partial<PollingConfig> | undefined;
}

/** The three states the service defines. */
const TASK_STATUSES: ReadonlySet<string> = new Set<TaskStatus>(["processing", "ready", "error"]);

/**
 * Client for the EzCaptchaSolver task API.
 *
 * ```ts
 * const client = new EzCapSolverClient({ clientKey: "..." });
 * const solved = await client.solve({
 *   type: "ReCaptchaV2TaskProxyless",
 *   websiteURL: "https://example.com",
 *   websiteKey: "6Lc...",
 * });
 * solved.solution.gRecaptchaResponse;
 * ```
 *
 * The client key falls back to the `EZCAPTCHA_API_KEY` environment variable.
 */
export class EzCapSolverClient {
  readonly #config: ResolvedConfig;

  /**
   * @throws EzCaptchaError of kind `config` when a setting is unusable.
   *   Everything checkable is checked here, so a bad setting surfaces before
   *   anything is billed.
   */
  constructor(options: ClientOptions = {}) {
    this.#config = resolveConfig(options);
  }

  /**
   * This client's effective configuration.
   *
   * The client key is not part of it — a credential that is never returned
   * cannot be logged by accident.
   */
  get config(): ClientConfig {
    const { clientKey: _clientKey, logger: _logger, fetch: _fetch, ...rest } = this.#config;
    return rest;
  }

  // -- Endpoints ------------------------------------------------------------

  /**
   * Creates an asynchronous task and returns its identifier.
   *
   * **This is the billed operation.** Hold on to the identifier: if anything
   * later fails, waiting on it again costs nothing, while creating a second
   * task is billed again.
   */
  async createTask(task: Task<string>, options: CallOptions = {}): Promise<string> {
    const { taskId } = await this.#createTask(task, options);
    return taskId;
  }

  /**
   * Queries an asynchronous task once, without waiting.
   *
   * A task that has not finished comes back with status `processing` and no
   * solution. Use {@link EzCapSolverClient.waitForResult} to poll until it does.
   */
  async getTaskResult(taskId: string, options: CallOptions = {}): Promise<TaskResult> {
    const envelope = await this.#post(
      endpoint(this.#config.asyncBaseUrl, PATH.getTaskResult),
      taskResultBody(this.#config.clientKey, taskId),
      this.#config.timeout,
      options.signal,
    );
    return toTaskResult(envelope);
  }

  /**
   * Polls an existing task until it finishes.
   *
   * @throws PollingExhaustedError when the budget runs out. The task may still
   *   finish afterwards, and the service holds its result for five minutes
   *   after creation — so waiting again on the same id is worth more than
   *   creating a second, billed task.
   */
  async waitForResult(taskId: string, options: SolveOptions = {}): Promise<TaskResult> {
    const polling = resolvePolling(this.#config.polling, options.polling);
    const { logger } = this.#config;

    for (let attempt = 1; attempt <= polling.maxAttempts; attempt++) {
      // Wait before every query, the first one included: a task that was just
      // created is still queued for a worker and would only report processing.
      await sleep(polling.interval, options.signal, `waiting for task ${taskId}`);

      logger?.debug?.({ taskId, attempt }, "polling task result");
      let result: TaskResult;
      try {
        result = await this.getTaskResult(taskId, options);
      } catch (error) {
        // Throttling says nothing about the task, which is still queued. Spend
        // the attempt and poll again rather than failing a task that has already
        // been billed. The attempt is spent on purpose: interval x maxAttempts
        // is what keeps the whole wait inside the five-minute window the result
        // is held for.
        if (error instanceof ApiError && error.isRateLimited()) {
          logger?.warn?.(
            { taskId, attempt, errorCode: error.errorCode },
            "polling throttled, retrying",
          );
          continue;
        }
        throw error;
      }

      if (result.status === "ready") {
        logger?.info?.({ taskId, attempts: attempt }, "task completed");
        return result;
      }
      if (result.status === "processing") continue;

      // A failed task arrives with errorId 1 and is already an ApiError by now,
      // so reaching this means the envelope contradicted itself.
      throw new UnexpectedResponseError(
        `task ${JSON.stringify(taskId)} reported status "error" without an API error`,
      );
    }

    throw new PollingExhaustedError(taskId, polling.maxAttempts, polling.interval);
  }

  /**
   * Runs a task through the synchronous endpoint, which answers on the
   * creating request and returns no task identifier to poll.
   */
  async createSyncTask(task: Task<string>, options: CallOptions = {}): Promise<TaskResult> {
    const envelope = await this.#post(
      endpoint(this.#config.syncBaseUrl, PATH.createSyncTask),
      createTaskBody(this.#config.clientKey, task.type, taskParams(task), this.#config.appId),
      this.#config.syncTimeout,
      options.signal,
    );
    return toTaskResult(envelope);
  }

  /** The account's remaining balance. For display, not for accounting. */
  async getBalance(options: CallOptions = {}): Promise<number> {
    const envelope = await this.#post(
      endpoint(this.#config.asyncBaseUrl, PATH.getBalance),
      balanceBody(this.#config.clientKey),
      this.#config.timeout,
      options.signal,
    );
    const balance = envelope["balance"];
    // A missing or non-numeric balance is a broken contract, not a zero balance.
    // The two call for opposite reactions, so they must not look alike.
    if (typeof balance !== "number" || !Number.isFinite(balance)) {
      throw new UnexpectedResponseError(
        "balance response does not contain a numeric balance",
        preview(JSON.stringify(envelope)),
      );
    }
    return balance;
  }

  // -- Orchestration --------------------------------------------------------

  /**
   * Creates a task, waits for it, and returns its solution.
   *
   * One call covers all 23 modelled types; the `type` field both selects the
   * parameters TypeScript will accept and infers the solution you get back.
   *
   * ```ts
   * const solved = await client.solve({
   *   type: "CloudFlareTurnstileTask",
   *   websiteURL: "https://example.com",
   *   websiteKey: "0x4...",
   * });
   * solved.solution.token;
   * ```
   *
   * A type this release does not model works too, with its solution typed as
   * an open object:
   *
   * ```ts
   * await client.solve({ type: "BrandNewTaskType", someParam: 1 });
   * ```
   *
   * @throws WaitInterruptedError when the task was created — and billed — but
   *   waiting for it failed. Recover with {@link EzCapSolverClient.waitForResult}
   *   on the identifier it carries rather than paying for a second task.
   */
  async solve<T extends TaskType>(
    task: { type: T } & ParamsFor<T>,
    options: SolveOptions = {},
  ): Promise<Solved<SolutionFor<T>>> {
    const { taskId, requestId } = await this.#createTask(task as Task<string>, options);
    try {
      const result = await this.waitForResult(taskId, options);
      return this.#solved(task.type, requireReady(result), taskId, requestId);
    } catch (error) {
      throw this.#waitFailure(error, taskId, requestId);
    }
  }

  /**
   * Runs a task through the synchronous endpoint and returns its solution.
   *
   * Identical to {@link EzCapSolverClient.solve} apart from the endpoint: the
   * answer arrives on the creating request, so there is no polling and no
   * identifier to recover with if it fails.
   */
  async syncSolve<T extends TaskType>(
    task: { type: T } & ParamsFor<T>,
    options: CallOptions = {},
  ): Promise<Solved<SolutionFor<T>>> {
    const result = await this.createSyncTask(task as Task<string>, options);
    return this.#solved(task.type, requireReady(result), result.taskId, result.requestId);
  }

  // -- Named shortcuts ------------------------------------------------------

  // Each pair is a one-line forward to solve/syncSolve. The method name is the
  // wire type with a prefix, matching the Rust and Go SDKs character for
  // character. They are equivalent to solve({ type: ... }), so a type the
  // service adds later does not have to wait for a method here.
  //
  // Parameters are wrapped in WithExtras<>, so unmodelled ones go inline rather
  // than under extra. That is why type is written after the spread: a type a
  // caller passes inline must not change what gets billed.

  /**
   * Solves a ReCaptcha V2 challenge, polling for the result.
   *
   * Task type: `ReCaptchaV2TaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV2TaskProxyless(
    params: WithExtras<ReCaptchaV2Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      { ...params, type: "ReCaptchaV2TaskProxyless" } as Task<"ReCaptchaV2TaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV2TaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV2TaskProxyless(
    params: WithExtras<ReCaptchaV2Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      { ...params, type: "ReCaptchaV2TaskProxyless" } as Task<"ReCaptchaV2TaskProxyless">,
      options,
    );
  }

  /**
   * Solves a ReCaptcha V2 challenge on the high-score queue, where the returned token scores at least 0.9, polling for the result.
   *
   * Task type: `ReCaptchaV2TaskProxylessS9`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV2TaskProxylessS9(
    params: WithExtras<ReCaptchaV2Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      { ...params, type: "ReCaptchaV2TaskProxylessS9" } as Task<"ReCaptchaV2TaskProxylessS9">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV2TaskProxylessS9} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV2TaskProxylessS9(
    params: WithExtras<ReCaptchaV2Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      { ...params, type: "ReCaptchaV2TaskProxylessS9" } as Task<"ReCaptchaV2TaskProxylessS9">,
      options,
    );
  }

  /**
   * Solves a ReCaptcha V2 challenge that carries an `s` parameter, which routes it to the high-score IPv4 queue, polling for the result.
   *
   * Task type: `ReCaptchaV2STaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV2STaskProxyless(
    params: WithExtras<ReCaptchaV2Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      { ...params, type: "ReCaptchaV2STaskProxyless" } as Task<"ReCaptchaV2STaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV2STaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV2STaskProxyless(
    params: WithExtras<ReCaptchaV2Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      { ...params, type: "ReCaptchaV2STaskProxyless" } as Task<"ReCaptchaV2STaskProxyless">,
      options,
    );
  }

  /**
   * Solves a ReCaptcha V2 Enterprise challenge, polling for the result.
   *
   * Task type: `ReCaptchaV2EnterpriseTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV2EnterpriseTaskProxyless(
    params: WithExtras<ReCaptchaV2Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      {
        ...params,
        type: "ReCaptchaV2EnterpriseTaskProxyless",
      } as Task<"ReCaptchaV2EnterpriseTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV2EnterpriseTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV2EnterpriseTaskProxyless(
    params: WithExtras<ReCaptchaV2Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      {
        ...params,
        type: "ReCaptchaV2EnterpriseTaskProxyless",
      } as Task<"ReCaptchaV2EnterpriseTaskProxyless">,
      options,
    );
  }

  /**
   * Solves a ReCaptcha V2 Enterprise challenge that carries an `s` parameter, polling for the result.
   *
   * Task type: `ReCaptchaV2SEnterpriseTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV2SEnterpriseTaskProxyless(
    params: WithExtras<ReCaptchaV2Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      {
        ...params,
        type: "ReCaptchaV2SEnterpriseTaskProxyless",
      } as Task<"ReCaptchaV2SEnterpriseTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV2SEnterpriseTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV2SEnterpriseTaskProxyless(
    params: WithExtras<ReCaptchaV2Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      {
        ...params,
        type: "ReCaptchaV2SEnterpriseTaskProxyless",
      } as Task<"ReCaptchaV2SEnterpriseTaskProxyless">,
      options,
    );
  }

  /**
   * Solves one ReCaptcha V2 image grid, polling for the result.
   *
   * Task type: `ReCaptchaV2Classification`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV2Classification(
    params: WithExtras<ReCaptchaV2ClassificationParams>,
    options?: SolveOptions,
  ): Promise<Solved<ReClassificationSolution>> {
    return this.solve(
      { ...params, type: "ReCaptchaV2Classification" } as Task<"ReCaptchaV2Classification">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV2Classification} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV2Classification(
    params: WithExtras<ReCaptchaV2ClassificationParams>,
    options?: CallOptions,
  ): Promise<Solved<ReClassificationSolution>> {
    return this.syncSolve(
      { ...params, type: "ReCaptchaV2Classification" } as Task<"ReCaptchaV2Classification">,
      options,
    );
  }

  /**
   * Solves a ReCaptcha V3 challenge, polling for the result.
   *
   * Task type: `ReCaptchaV3TaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV3TaskProxyless(
    params: WithExtras<ReCaptchaV3Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      { ...params, type: "ReCaptchaV3TaskProxyless" } as Task<"ReCaptchaV3TaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV3TaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV3TaskProxyless(
    params: WithExtras<ReCaptchaV3Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      { ...params, type: "ReCaptchaV3TaskProxyless" } as Task<"ReCaptchaV3TaskProxyless">,
      options,
    );
  }

  /**
   * Solves a ReCaptcha V3 challenge on the high-score queue, polling for the result.
   *
   * Task type: `ReCaptchaV3TaskProxylessS9`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV3TaskProxylessS9(
    params: WithExtras<ReCaptchaV3Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      { ...params, type: "ReCaptchaV3TaskProxylessS9" } as Task<"ReCaptchaV3TaskProxylessS9">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV3TaskProxylessS9} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV3TaskProxylessS9(
    params: WithExtras<ReCaptchaV3Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      { ...params, type: "ReCaptchaV3TaskProxylessS9" } as Task<"ReCaptchaV3TaskProxylessS9">,
      options,
    );
  }

  /**
   * Solves a ReCaptcha V3 Enterprise challenge, polling for the result.
   *
   * Task type: `ReCaptchaV3EnterpriseTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV3EnterpriseTaskProxyless(
    params: WithExtras<ReCaptchaV3Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      {
        ...params,
        type: "ReCaptchaV3EnterpriseTaskProxyless",
      } as Task<"ReCaptchaV3EnterpriseTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV3EnterpriseTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV3EnterpriseTaskProxyless(
    params: WithExtras<ReCaptchaV3Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      {
        ...params,
        type: "ReCaptchaV3EnterpriseTaskProxyless",
      } as Task<"ReCaptchaV3EnterpriseTaskProxyless">,
      options,
    );
  }

  /**
   * Solves a ReCaptcha V3 Enterprise challenge on the high-score queue, polling for the result.
   *
   * Task type: `ReCaptchaV3EnterpriseTaskProxylessS9`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveReCaptchaV3EnterpriseTaskProxylessS9(
    params: WithExtras<ReCaptchaV3Params>,
    options?: SolveOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.solve(
      {
        ...params,
        type: "ReCaptchaV3EnterpriseTaskProxylessS9",
      } as Task<"ReCaptchaV3EnterpriseTaskProxylessS9">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveReCaptchaV3EnterpriseTaskProxylessS9} on the
   * synchronous endpoint.
   */
  syncSolveReCaptchaV3EnterpriseTaskProxylessS9(
    params: WithExtras<ReCaptchaV3Params>,
    options?: CallOptions,
  ): Promise<Solved<RecaptchaSolution>> {
    return this.syncSolve(
      {
        ...params,
        type: "ReCaptchaV3EnterpriseTaskProxylessS9",
      } as Task<"ReCaptchaV3EnterpriseTaskProxylessS9">,
      options,
    );
  }

  /**
   * Solves a FunCaptcha (Arkose Labs) challenge, polling for the result.
   *
   * Task type: `FuncaptchaTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveFuncaptchaTaskProxyless(
    params: WithExtras<FunCaptchaParams>,
    options?: SolveOptions,
  ): Promise<Solved<FunCaptchaSolution>> {
    return this.solve(
      { ...params, type: "FuncaptchaTaskProxyless" } as Task<"FuncaptchaTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveFuncaptchaTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveFuncaptchaTaskProxyless(
    params: WithExtras<FunCaptchaParams>,
    options?: CallOptions,
  ): Promise<Solved<FunCaptchaSolution>> {
    return this.syncSolve(
      { ...params, type: "FuncaptchaTaskProxyless" } as Task<"FuncaptchaTaskProxyless">,
      options,
    );
  }

  /**
   * Solves one FunCaptcha image, polling for the result.
   *
   * Task type: `FunCaptchaClassification`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveFunCaptchaClassification(
    params: WithExtras<FunCaptchaClassificationParams>,
    options?: SolveOptions,
  ): Promise<Solved<FunCaptchaClassificationSolution>> {
    return this.solve(
      { ...params, type: "FunCaptchaClassification" } as Task<"FunCaptchaClassification">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveFunCaptchaClassification} on the
   * synchronous endpoint.
   */
  syncSolveFunCaptchaClassification(
    params: WithExtras<FunCaptchaClassificationParams>,
    options?: CallOptions,
  ): Promise<Solved<FunCaptchaClassificationSolution>> {
    return this.syncSolve(
      { ...params, type: "FunCaptchaClassification" } as Task<"FunCaptchaClassification">,
      options,
    );
  }

  /**
   * Solves a PerimeterX challenge, polling for the result.
   *
   * Task type: `PerimeterX`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solvePerimeterX(
    params: WithExtras<PerimeterXParams>,
    options?: SolveOptions,
  ): Promise<Solved<PerimeterXSolution>> {
    return this.solve({ ...params, type: "PerimeterX" } as Task<"PerimeterX">, options);
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solvePerimeterX} on the
   * synchronous endpoint.
   */
  syncSolvePerimeterX(
    params: WithExtras<PerimeterXParams>,
    options?: CallOptions,
  ): Promise<Solved<PerimeterXSolution>> {
    return this.syncSolve({ ...params, type: "PerimeterX" } as Task<"PerimeterX">, options);
  }

  /**
   * Solves an HCaptcha challenge, polling for the result.
   *
   * Task type: `HCaptcha`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveHCaptcha(
    params: WithExtras<HCaptchaParams>,
    options?: SolveOptions,
  ): Promise<Solved<HCaptchaSolution>> {
    return this.solve({ ...params, type: "HCaptcha" } as Task<"HCaptcha">, options);
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveHCaptcha} on the
   * synchronous endpoint.
   */
  syncSolveHCaptcha(
    params: WithExtras<HCaptchaParams>,
    options?: CallOptions,
  ): Promise<Solved<HCaptchaSolution>> {
    return this.syncSolve({ ...params, type: "HCaptcha" } as Task<"HCaptcha">, options);
  }

  /**
   * Solves one HCaptcha image, polling for the result.
   *
   * Task type: `HCaptchaClassification`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveHCaptchaClassification(
    params: WithExtras<HCaptchaClassificationParams>,
    options?: SolveOptions,
  ): Promise<Solved<HCaptchaClassificationSolution>> {
    return this.solve(
      { ...params, type: "HCaptchaClassification" } as Task<"HCaptchaClassification">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveHCaptchaClassification} on the
   * synchronous endpoint.
   */
  syncSolveHCaptchaClassification(
    params: WithExtras<HCaptchaClassificationParams>,
    options?: CallOptions,
  ): Promise<Solved<HCaptchaClassificationSolution>> {
    return this.syncSolve(
      { ...params, type: "HCaptchaClassification" } as Task<"HCaptchaClassification">,
      options,
    );
  }

  /**
   * Solves one round of the Akamai Web flow, polling for the result.
   *
   * Task type: `AkamaiWEBTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveAkamaiWEBTaskProxyless(
    params: WithExtras<AkamaiWebParams>,
    options?: SolveOptions,
  ): Promise<Solved<AkamaiWebSolution>> {
    return this.solve(
      { ...params, type: "AkamaiWEBTaskProxyless" } as Task<"AkamaiWEBTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveAkamaiWEBTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveAkamaiWEBTaskProxyless(
    params: WithExtras<AkamaiWebParams>,
    options?: CallOptions,
  ): Promise<Solved<AkamaiWebSolution>> {
    return this.syncSolve(
      { ...params, type: "AkamaiWEBTaskProxyless" } as Task<"AkamaiWEBTaskProxyless">,
      options,
    );
  }

  /**
   * Solves an Akamai SBSD challenge, polling for the result.
   *
   * Task type: `AkamaiSBSDTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveAkamaiSBSDTaskProxyless(
    params: WithExtras<AkamaiSbsdParams>,
    options?: SolveOptions,
  ): Promise<Solved<AkamaiSbsdSolution>> {
    return this.solve(
      { ...params, type: "AkamaiSBSDTaskProxyless" } as Task<"AkamaiSBSDTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveAkamaiSBSDTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveAkamaiSBSDTaskProxyless(
    params: WithExtras<AkamaiSbsdParams>,
    options?: CallOptions,
  ): Promise<Solved<AkamaiSbsdSolution>> {
    return this.syncSolve(
      { ...params, type: "AkamaiSBSDTaskProxyless" } as Task<"AkamaiSBSDTaskProxyless">,
      options,
    );
  }

  /**
   * Solves one HTTP request forwarded through the worker's TLS fingerprint, polling for the result.
   *
   * Task type: `TlsTask`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveTlsTask(
    params: WithExtras<TlsForwardParams>,
    options?: SolveOptions,
  ): Promise<Solved<TlsForwardSolution>> {
    return this.solve({ ...params, type: "TlsTask" } as Task<"TlsTask">, options);
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveTlsTask} on the
   * synchronous endpoint.
   */
  syncSolveTlsTask(
    params: WithExtras<TlsForwardParams>,
    options?: CallOptions,
  ): Promise<Solved<TlsForwardSolution>> {
    return this.syncSolve({ ...params, type: "TlsTask" } as Task<"TlsTask">, options);
  }

  /**
   * Solves a Cloudflare five-second interstitial, polling for the result.
   *
   * Task type: `CloudFlare5STask`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveCloudFlare5STask(
    params: WithExtras<Cloudflare5sParams>,
    options?: SolveOptions,
  ): Promise<Solved<Cloudflare5sSolution>> {
    return this.solve({ ...params, type: "CloudFlare5STask" } as Task<"CloudFlare5STask">, options);
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveCloudFlare5STask} on the
   * synchronous endpoint.
   */
  syncSolveCloudFlare5STask(
    params: WithExtras<Cloudflare5sParams>,
    options?: CallOptions,
  ): Promise<Solved<Cloudflare5sSolution>> {
    return this.syncSolve(
      { ...params, type: "CloudFlare5STask" } as Task<"CloudFlare5STask">,
      options,
    );
  }

  /**
   * Solves a Cloudflare Turnstile widget, polling for the result.
   *
   * Task type: `CloudFlareTurnstileTask`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveCloudFlareTurnstileTask(
    params: WithExtras<CloudflareTurnstileParams>,
    options?: SolveOptions,
  ): Promise<Solved<CloudflareTurnstileSolution>> {
    return this.solve(
      { ...params, type: "CloudFlareTurnstileTask" } as Task<"CloudFlareTurnstileTask">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveCloudFlareTurnstileTask} on the
   * synchronous endpoint.
   */
  syncSolveCloudFlareTurnstileTask(
    params: WithExtras<CloudflareTurnstileParams>,
    options?: CallOptions,
  ): Promise<Solved<CloudflareTurnstileSolution>> {
    return this.syncSolve(
      { ...params, type: "CloudFlareTurnstileTask" } as Task<"CloudFlareTurnstileTask">,
      options,
    );
  }

  /**
   * Solves a DataDome challenge step, polling for the result.
   *
   * Task type: `DataDomeTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveDataDomeTaskProxyless(
    params: WithExtras<DataDomeParams>,
    options?: SolveOptions,
  ): Promise<Solved<DataDomeSolution>> {
    return this.solve(
      { ...params, type: "DataDomeTaskProxyless" } as Task<"DataDomeTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveDataDomeTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveDataDomeTaskProxyless(
    params: WithExtras<DataDomeParams>,
    options?: CallOptions,
  ): Promise<Solved<DataDomeSolution>> {
    return this.syncSolve(
      { ...params, type: "DataDomeTaskProxyless" } as Task<"DataDomeTaskProxyless">,
      options,
    );
  }

  /**
   * Solves a DataDome tags challenge, polling for the result.
   *
   * Task type: `DataDomeTagsTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveDataDomeTagsTaskProxyless(
    params: WithExtras<DataDomeTagsParams>,
    options?: SolveOptions,
  ): Promise<Solved<DataDomeSolution>> {
    return this.solve(
      { ...params, type: "DataDomeTagsTaskProxyless" } as Task<"DataDomeTagsTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveDataDomeTagsTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveDataDomeTagsTaskProxyless(
    params: WithExtras<DataDomeTagsParams>,
    options?: CallOptions,
  ): Promise<Solved<DataDomeSolution>> {
    return this.syncSolve(
      { ...params, type: "DataDomeTagsTaskProxyless" } as Task<"DataDomeTagsTaskProxyless">,
      options,
    );
  }

  /**
   * Solves an Incapsula Reese84 sensor challenge, polling for the result.
   *
   * Task type: `IncapsulaTaskProxyless`. Parameters this release does not model can be passed
   * inline alongside the declared ones.
   */
  solveIncapsulaTaskProxyless(
    params: WithExtras<IncapsulaParams>,
    options?: SolveOptions,
  ): Promise<Solved<IncapsulaSolution>> {
    return this.solve(
      { ...params, type: "IncapsulaTaskProxyless" } as Task<"IncapsulaTaskProxyless">,
      options,
    );
  }

  /**
   * Solves the same task as {@link EzCapSolverClient.solveIncapsulaTaskProxyless} on the
   * synchronous endpoint.
   */
  syncSolveIncapsulaTaskProxyless(
    params: WithExtras<IncapsulaParams>,
    options?: CallOptions,
  ): Promise<Solved<IncapsulaSolution>> {
    return this.syncSolve(
      { ...params, type: "IncapsulaTaskProxyless" } as Task<"IncapsulaTaskProxyless">,
      options,
    );
  }

  // -- Internals ------------------------------------------------------------

  /** Sends one request with this client's transport settings. */
  #post(
    url: string,
    body: unknown,
    timeout: number,
    signal: AbortSignal | undefined,
  ): Promise<Record<string, unknown>> {
    const context: RequestContext = {
      fetch: this.#config.fetch,
      clientKey: this.#config.clientKey,
      userAgent: this.#config.userAgent,
      logger: this.#config.logger,
      signal,
    };
    return postJson(context, url, body, timeout);
  }

  /** Creates a task and extracts the identifiers the response carries. */
  async #createTask(
    task: Task<string>,
    options: CallOptions,
  ): Promise<{ taskId: string; requestId: string | undefined }> {
    const envelope = await this.#post(
      endpoint(this.#config.asyncBaseUrl, PATH.createTask),
      createTaskBody(this.#config.clientKey, task.type, taskParams(task), this.#config.appId),
      this.#config.timeout,
      options.signal,
    );

    const taskId = asString(envelope["taskId"]);
    if (taskId === undefined) {
      throw new UnexpectedResponseError(
        "successful create-task response does not contain a task ID",
        preview(JSON.stringify(envelope)),
      );
    }
    const requestId = asString(envelope["requestId"]);
    this.#config.logger?.info?.({ taskId, taskType: task.type }, "task created");
    return { taskId, requestId };
  }

  /** Decodes a ready result into the solution its task type resolves to. */
  #solved<T extends string>(
    taskType: T,
    result: ReadyTaskResult,
    taskId: string | undefined,
    requestId: string | undefined,
  ): Solved<SolutionFor<T>> {
    const raw = result.solution;
    const solution = decodeSolution(taskType, raw, JSON.stringify(raw) ?? String(raw));
    const solved: Solved<SolutionFor<T>> = { solution, raw };
    // The asynchronous path uses the id from creation; the synchronous path has
    // none, so it falls back to the one the response carried.
    const resolvedTaskId = taskId ?? result.taskId;
    if (resolvedTaskId !== undefined) solved.taskId = resolvedTaskId;
    // The result request's correlation id is the closest one to the response the
    // caller is holding; fall back to the creating request when it carried none.
    const resolvedRequestId = result.requestId ?? requestId;
    if (resolvedRequestId !== undefined) solved.requestId = resolvedRequestId;
    return solved;
  }

  /**
   * Attaches the billed task's identifier to a failure that lost it.
   *
   * `solve` creates the task internally, so an error that drops the identifier
   * strands a result the caller already paid for. Errors that carry it
   * themselves are returned untouched — wrapping them would only make an
   * existing `catch` miss.
   */
  #waitFailure(error: unknown, taskId: string, requestId: string | undefined): unknown {
    if (error instanceof ApiError) {
      error.taskId ??= taskId;
      return error;
    }
    if (!isEzCaptchaError(error) || error.kind === "polling-exhausted") {
      return error;
    }
    return new WaitInterruptedError(taskId, requestId, error);
  }
}

/**
 * Turns a response envelope into a {@link TaskResult}.
 *
 * A ready result without a solution is rejected here rather than later: the
 * type says the field is present, so the parser is what has to make that true.
 * The other SDKs raise the same error when the solution is read instead, which
 * is a few microseconds later and the same outcome.
 */
function toTaskResult(envelope: Record<string, unknown>): TaskResult {
  const status = envelope["status"];
  if (typeof status !== "string") {
    // Request-level failures (an invalid key, an unknown task id) may omit
    // status, but their error envelopes are handled before reaching this code.
    // A missing status here therefore breaks the contract.
    throw new UnexpectedResponseError(
      "successful task response does not contain a status field",
      preview(JSON.stringify(envelope)),
    );
  }
  if (!TASK_STATUSES.has(status)) {
    throw new UnexpectedResponseError(
      `unknown task status ${JSON.stringify(status)}`,
      preview(JSON.stringify(envelope)),
    );
  }

  const base = {
    ...(asString(envelope["taskId"]) !== undefined && {
      taskId: envelope["taskId"] as string,
    }),
    ...(asString(envelope["requestId"]) !== undefined && {
      requestId: envelope["requestId"] as string,
    }),
    ...(asString(envelope["errorCode"]) !== undefined && {
      errorCode: envelope["errorCode"] as string,
    }),
    ...(asString(envelope["errorDescription"]) !== undefined && {
      errorDescription: envelope["errorDescription"] as string,
    }),
  };

  if (status === "ready") {
    // "Field absent" and "field is null" are different things: the first means
    // the task has not finished, the second that the worker finished and
    // returned nothing. `in` tells them apart, with no sentinel value needed.
    if (!("solution" in envelope)) {
      throw new UnexpectedResponseError(MISSING_SOLUTION_REASON, preview(JSON.stringify(envelope)));
    }
    return { ...base, status, solution: envelope["solution"] };
  }
  if (status === "processing") return { ...base, status };
  return { ...base, status: "error", solution: envelope["solution"] };
}

/**
 * Rejects a result that is not a finished, successful task.
 *
 * A failed task normally arrives with `errorId` 1 and has already become an
 * `ApiError`, so reaching here means the envelope contradicted itself.
 * Returning it as a solution would hand the caller a `Solved` with nothing in
 * it.
 */
function requireReady(result: TaskResult): ReadyTaskResult {
  if (result.status === "ready") return result;
  throw new UnexpectedResponseError(
    `task result ${result.status === "processing" ? "still processing" : 'reported status "error"'} without an API error`,
  );
}
