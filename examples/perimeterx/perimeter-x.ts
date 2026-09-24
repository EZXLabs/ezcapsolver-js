/**
 * Solve a PerimeterX (Press & Hold) challenge.
 *
 * Task type: `PerimeterX`
 *
 * The worker returns the clearance cookies as top-level fields, with the leading
 * underscore their cookie names carry.
 *
 * Docs: https://docs.ezxlabs.com/docs/captcha/api/perimeterx
 *
 * Run: node --experimental-strip-types examples/perimeterx/perimeter-x.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient();

const solved = await client.solvePerimeterX({
  // PerimeterX application identifier; it starts with PX.
  websiteKey: "PXxxxxxxxx",
  invisible: false,
});

const { solution } = solved;
console.log(`Request ID: ${solved.requestId ?? "-"}`);
console.log(`Task ID:    ${solved.taskId ?? "-"}`);
console.log(`_px3:       ${solution._px3.slice(0, 64)}...`);
console.log(`_pxvid:     ${solution._pxvid ?? "-"}`);
console.log(`_pxde:      ${solution._pxde ?? "-"}`);
console.log(`Balance:    ${await client.getBalance()}`);
