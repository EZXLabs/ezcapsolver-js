/**
 * Solve many challenges at once through a single client.
 *
 * One client is enough for any number of concurrent calls: it holds no
 * per-request state, and `fetch` pools connections underneath. Creating one
 * client per task only throws away that pooling.
 *
 * Run: node --experimental-strip-types examples/concurrency.ts
 * (Node 23.6 and later need no flag.)
 */

import { EzCapSolverClient, taskIdOf } from "ezcapsolver-js";

const SITES = [
  { websiteURL: "https://example.com/a", websiteKey: "6Lc-key-a" },
  { websiteURL: "https://example.com/b", websiteKey: "6Lc-key-b" },
  { websiteURL: "https://example.com/c", websiteKey: "6Lc-key-c" },
];

const client = new EzCapSolverClient();

// `allSettled` rather than `all`: one failure must not discard the tasks that
// succeeded, because every one of them was billed.
const results = await Promise.allSettled(
  SITES.map((site) => client.solveReCaptchaV2TaskProxyless(site)),
);

for (const [index, result] of results.entries()) {
  const label = SITES[index]?.websiteURL ?? `#${index}`;
  if (result.status === "fulfilled") {
    console.log(`${label}: ${result.value.solution.gRecaptchaResponse.slice(0, 32)}...`);
    continue;
  }

  // A task that was created and billed leaves its id on the error. Waiting on
  // it again is free; creating a replacement is not.
  const taskId = taskIdOf(result.reason);
  console.log(`${label}: failed — ${String(result.reason)}`);
  if (taskId !== undefined) {
    console.log(`${label}: recover with waitForResult(${taskId})`);
  }
}

// --- Bounding concurrency ---------------------------------------------------
//
// Nothing above limits how many requests are in flight. The service applies its
// own rate limits per key, and a few hundred simultaneous creates will hit
// them. Cap the fan-out when the list is large:

async function solveWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let start = 0; start < items.length; start += limit) {
    const batch = items.slice(start, start + limit);
    results.push(...(await Promise.allSettled(batch.map(run))));
  }
  return results;
}

const bounded = await solveWithLimit(SITES, 2, (site) =>
  client.solveReCaptchaV2TaskProxyless(site),
);
console.log(`Bounded run: ${bounded.filter((r) => r.status === "fulfilled").length} solved`);

// A single AbortSignal can cancel the whole fan-out at once — every call
// merges it with its own timeout, so whichever fires first wins.
const controller = new AbortController();
setTimeout(() => controller.abort(), 60_000);
await Promise.allSettled(
  SITES.map((site) => client.solveReCaptchaV2TaskProxyless(site, { signal: controller.signal })),
);
