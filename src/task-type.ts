/**
 * Task types.
 *
 * The wire values below carry the service's own irregularities —
 * `FuncaptchaTaskProxyless` has a lowercase `c` while
 * `FunCaptchaClassification` does not, and `AkamaiWEBTaskProxyless` is shouted.
 * The SDK is part of the published documentation, so it sends these as the
 * catalog spells them.
 *
 * One is deliberately normalised: the catalog writes the V3 Enterprise S9 type
 * as `RecaptchaV3EnterpriseTaskProxylessS9`, and the SDKs send
 * `ReCaptchaV3EnterpriseTaskProxylessS9` so that one capitalisation runs
 * through the whole ReCaptcha family. The service matches task types
 * case-insensitively, so this reaches the same worker.
 *
 * Unlike the other SDKs there is no separate identifier for each type: a
 * string literal union *is* the enum in TypeScript, and it is what drives the
 * inference on `solve`.
 *
 * @module
 */

/**
 * Task types this release models, in the order the task catalog documents
 * them.
 *
 * Being listed here says nothing about availability: whether a type can be
 * used depends on service-side configuration and on the caller's plan, which
 * is not something the SDK can predict.
 */
export const KNOWN_TASK_TYPES = [
  "ReCaptchaV2TaskProxyless",
  "ReCaptchaV2TaskProxylessS9",
  "ReCaptchaV2STaskProxyless",
  "ReCaptchaV2EnterpriseTaskProxyless",
  "ReCaptchaV2SEnterpriseTaskProxyless",
  "ReCaptchaV2Classification",
  "ReCaptchaV3TaskProxyless",
  "ReCaptchaV3TaskProxylessS9",
  "ReCaptchaV3EnterpriseTaskProxyless",
  "ReCaptchaV3EnterpriseTaskProxylessS9",
  "FuncaptchaTaskProxyless",
  "FunCaptchaClassification",
  "PerimeterX",
  "HCaptcha",
  "HCaptchaClassification",
  "AkamaiWEBTaskProxyless",
  "AkamaiSBSDTaskProxyless",
  "TlsTask",
  "CloudFlare5STask",
  "CloudFlareTurnstileTask",
  "DataDomeTaskProxyless",
  "DataDomeTagsTaskProxyless",
  "IncapsulaTaskProxyless",
] as const;

/** One of the 23 task types this release models. */
export type KnownTaskType = (typeof KNOWN_TASK_TYPES)[number];

/**
 * The value sent in a task's `type` field.
 *
 * `(string & {})` keeps the literal union's autocompletion while still
 * accepting a type the service adds after this release — so a new type works
 * without waiting for an SDK update.
 *
 * ```ts
 * await client.solve({ type: "BrandNewTaskType", someParam: 1 });
 * ```
 */
export type TaskType = KnownTaskType | (string & {});

/** The endpoint a task type is executed through. */
export type TaskMode = "async" | "sync";

/**
 * The subset executed through `/createSyncTask`, which returns the terminal
 * result inline and no task ID.
 */
const SYNC_TASK_TYPES: ReadonlySet<string> = new Set<KnownTaskType>([
  "ReCaptchaV2Classification",
  "FunCaptchaClassification",
  "HCaptchaClassification",
  "AkamaiWEBTaskProxyless",
  "AkamaiSBSDTaskProxyless",
  "TlsTask",
  "DataDomeTaskProxyless",
  "DataDomeTagsTaskProxyless",
  "IncapsulaTaskProxyless",
]);

const KNOWN_TASK_TYPE_SET: ReadonlySet<string> = new Set(KNOWN_TASK_TYPES);

/** Whether this release models the type. */
export function isKnownTaskType(type: TaskType): type is KnownTaskType {
  return KNOWN_TASK_TYPE_SET.has(type);
}

/**
 * The endpoint the service documents for the type, or `undefined` when this
 * release does not know the type at all.
 *
 * This is informational. Every type has both a `solve` path that polls and a
 * `syncSolve` path that uses the synchronous endpoint, and nothing in the SDK
 * reads this value to pick between them.
 *
 * It matters because the service may reject a type on the endpoint it does not
 * serve — so this is the mode to follow when there is no reason to prefer the
 * other. Such a rejection is refused before billing, so it costs a round trip
 * rather than a task.
 */
export function taskMode(type: TaskType): TaskMode | undefined {
  if (SYNC_TASK_TYPES.has(type)) return "sync";
  return isKnownTaskType(type) ? "async" : undefined;
}
