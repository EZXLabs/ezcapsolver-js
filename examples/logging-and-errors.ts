/**
 * Turn on logging, and tell the kinds of failure apart.
 *
 * Run: node --experimental-strip-types examples/logging-and-errors.ts
 * (Node 23.6 and later need no flag.)
 */

import {
  ApiError,
  consoleLogger,
  EzCapSolverClient,
  isApiError,
  isDecodeError,
  isEzCaptchaError,
  isPollingExhaustedError,
  isTransportError,
  SolutionDecodeError,
  taskIdOf,
} from "ezcapsolver-js";

// Logging is discarded unless a logger is supplied. `trace` adds full request
// and response bodies, with clientKey and proxy replaced at any nesting depth
// — nothing is even rendered below that level, so leaving it off costs
// nothing. Any pino instance can be passed here instead.
const client = new EzCapSolverClient({ logger: consoleLogger("trace") });

try {
  const solved = await client.solveReCaptchaV2TaskProxyless({
    websiteURL: "https://www.google.com/recaptcha/api2/demo",
    websiteKey: "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
  });
  console.log(`Solved:     ${solved.solution.gRecaptchaResponse.slice(0, 64)}...`);
} catch (error) {
  classify(error);
}

/** Shows what each failure layer means and what to do about it. */
function classify(error: unknown): void {
  // Ask this first. Whether a billed task is still recoverable matters more
  // than what broke, because it decides whether you pay again — and it is one
  // question regardless of which error type happens to carry the id.
  const taskId = taskIdOf(error);
  if (taskId !== undefined) {
    console.log(`Recover:    waitForResult(${taskId}) — do not create a second task`);
  }

  if (isApiError(error)) {
    // The service answered with a structured error. What to do next depends on
    // the code, so the code is what you branch on.
    console.log(`API error:  ${error.errorCode}`);
    console.log(`HTTP:       ${error.httpStatus}`);
    for (const [field, reason] of Object.entries(error.errors ?? {})) {
      console.log(`  ${field}: ${reason}`);
    }

    if (error.isAuthenticationError()) {
      // Stop. Do not back off and try again: the service counts these per key,
      // and thirty within a minute earn a three-minute ban.
      console.log("Fix the key or top up the balance; retrying will get you banned.");
    } else if (error.isTerminal()) {
      console.log("The same request will fail the same way. Change it.");
    } else if (error.isRateLimited()) {
      // Throttling refuses the query, not the task. waitForResult already polls
      // through one of these on its own.
      console.log("Throttled. Both codes clear on their own; ask again later.");
    } else {
      console.log("This one may be transient. Backing off is up to you.");
    }
    return;
  }

  if (isTransportError(error)) {
    // The request never produced a response. Whether resending is safe depends
    // on what was being done: creating a task is billed and is not idempotent,
    // and a timeout cannot tell you whether the service already accepted it.
    // Treat a create timeout as a terminal failure.
    console.log(`Transport:  ${error.message}`);
    console.log(`Operation:  ${error.op}`);
    return;
  }

  if (isPollingExhaustedError(error)) {
    // The budget ran out, but the task may still finish. Its id stays valid for
    // five minutes after creation, so the result can be fetched later.
    console.log(`Gave up on ${error.taskId} after ${error.attempts} attempts`);
    return;
  }

  if (isDecodeError(error)) {
    // Either the worker returned a shape this release does not model, in which
    // case the raw value travels with the error and is the only thing that
    // explains it, or the response broke the contract some other way — a ready
    // result with no solution field at all, for instance.
    if (error instanceof SolutionDecodeError) {
      console.log(`Undecodable solution: ${error.raw}`);
    } else {
      console.log(`Unusable response: ${error.message}`);
    }
    return;
  }

  if (isEzCaptchaError(error)) {
    // A configuration failure, or a wait that was interrupted. The latter
    // wraps what actually broke, so `cause` still classifies.
    console.log(`${error.kind}: ${error.message}`);
    if (error.cause instanceof ApiError) {
      console.log(`Underlying: ${error.cause.errorCode}`);
    }
    return;
  }

  console.log(`Unclassified: ${String(error)}`);
}
