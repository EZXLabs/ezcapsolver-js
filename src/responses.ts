/**
 * Response models.
 *
 * ## Why this is a union rather than one shape
 *
 * The Python SDK needs a `MISSING` sentinel object to tell "the response had
 * no `solution` field" from "the field was JSON `null`", plus `has_solution` /
 * `is_ready` properties to ask about it. Go needs `HasSolution()` and three
 * `IsX()` predicates for the same reason: their result types are one closed
 * struct that has to describe every state at once.
 *
 * TypeScript can say it directly. {@link TaskResult} is a union discriminated
 * on `status`, so comparing that field narrows the rest:
 *
 * ```ts
 * const result = await client.getTaskResult(taskId);
 * if (result.status === "ready") {
 *   result.solution;  // unknown — guaranteed present, no predicate needed
 * }
 * ```
 *
 * The absent-versus-null distinction that `MISSING` exists for is native here:
 * `"solution" in data` answers it without a sentinel.
 *
 * @module
 */

/**
 * The state the service reports for a task.
 *
 * The service defines exactly three, so an unrecognised value is a contract
 * break and is reported as `UnexpectedResponseError` rather than being quietly
 * treated as "still processing".
 */
export type TaskStatus = "processing" | "ready" | "error";

/** Fields every task response carries, whatever its status. */
interface TaskResultBase {
  /**
   * The identifier the synchronous endpoint assigns.
   *
   * `createSyncTask` returns one on both the success and the failure path.
   * `getTaskResult` does not echo it back, so it is absent there.
   */
  taskId?: string;
  /** The service-side request tracking identifier. */
  requestId?: string;
  /** A task-level error code. */
  errorCode?: string;
  /** A task-level error description. */
  errorDescription?: string;
}

/** The task is still being worked on. */
export interface ProcessingTaskResult extends TaskResultBase {
  status: "processing";
}

/**
 * The task succeeded and its solution is available.
 *
 * `solution` is guaranteed present: a ready response without one breaks the
 * contract, and the parser rejects it before this type is constructed.
 *
 * It may still be `null` — that is the worker saying it finished and produced
 * nothing, which is a different thing from an unfinished task.
 */
export interface ReadyTaskResult extends TaskResultBase {
  status: "ready";
  /** The raw solution value, exactly as the worker produced it. */
  solution: unknown;
}

/**
 * The task failed.
 *
 * Such a response also carries a non-zero `errorId`, so it normally surfaces
 * as an `ApiError` rather than reaching a caller as a result.
 */
export interface ErroredTaskResult extends TaskResultBase {
  status: "error";
  solution?: unknown;
}

/** What `getTaskResult` and `createSyncTask` return. */
export type TaskResult = ProcessingTaskResult | ReadyTaskResult | ErroredTaskResult;

/**
 * A finished task: its solution plus the identifiers it came with.
 *
 * Unlike the other SDKs there is no `extra` bucket to consult — the solution
 * object keeps every field the worker sent, declared or not. {@link Solved.raw}
 * is still here for the cases where the exact bytes matter, such as
 * reproducing a worker's output or diagnosing a shape this release does not
 * model.
 */
export interface Solved<S> {
  /** The solution, checked against the fields its task type always returns. */
  solution: S;
  /** The untouched solution value the worker returned. */
  raw: unknown;
  /**
   * The identifier the service assigned. Both endpoints supply one: the
   * asynchronous path from task creation, the synchronous path alongside the
   * result.
   */
  taskId?: string;
  /** The service-side request tracking identifier. */
  requestId?: string;
}
