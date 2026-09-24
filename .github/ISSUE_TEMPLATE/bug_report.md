---
name: Bug Report
about: Report a bug to help us improve
title: "[Bug] "
labels: bug
---

## Problem Description

<!-- Clearly and concisely describe the bug -->

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

<!-- Describe what you expected to happen -->

## Environment Information

- OS:
- Node version (`node --version`):
- Package manager and version:
- Module system: <!-- ESM (import) or CJS (require) -->
- `ezcapsolver-js` version:
- Task type involved:

## Additional Information

<!--
Logs or other information helpful for locating the issue.

Pass a logger with a `trace` method to capture the request and response
bodies; the SDK replaces clientKey and proxy at any nesting depth:

    import { consoleLogger, EzCapSolverClient } from "ezcapsolver-js";

    const client = new EzCapSolverClient({ logger: consoleLogger("trace") });

If a solution failed to decode, SolutionDecodeError.raw holds the exact shape
the worker returned — that is the single most useful thing to attach. A
solution object keeps every field the worker sent, declared or not, and
Solved.raw keeps the original value, so nothing is lost on the way to you.
-->
