/**
 * Solution models, one per task family. Several task types share one model
 * where the worker returns the same shape.
 *
 * Two rules hold for all of them:
 *
 * - nothing is ever dropped — a field a worker starts returning stays on the
 *   solution object and is reachable with `solution["newField"]`;
 * - a field is only declared required when the service has confirmed the
 *   worker always returns it. A worker that omits an optional field yields
 *   `undefined`, not a decoding failure.
 *
 * The service does not define these shapes — workers do, and workers change
 * faster than the SDK.
 *
 * ## Why there is no `extra` bucket
 *
 * The Rust, Go and Python SDKs collect unmodelled worker fields into an
 * `extra` map, because their structs are closed: an unknown key has nowhere
 * else to go. JavaScript objects are open, so the decoded solution *is* the
 * lossless representation. An `extra` bucket here would import a workaround
 * for a problem this language does not have, and would make a new field
 * readable as `solution.extra.x` rather than `solution["x"]`.
 *
 * Field names are the worker's own, verbatim — `sec_ch_ua`, `_px3`,
 * `generated_pass_UUID`. Renaming them to camelCase would mean maintaining a
 * mapping table that buys nothing.
 *
 * @module
 */

import { SolutionDecodeError } from "./errors.js";
import type { KnownTaskType } from "./task-type.js";

/**
 * Fields a worker may return beyond the ones a model declares.
 *
 * Reach them with `solution["fieldName"]`; the bracket is deliberate, since it
 * marks the value as one the SDK makes no promises about.
 */
export interface UnmodelledFields {
  [key: string]: unknown;
}

/**
 * The token returned by every ReCaptcha V2 and V3 token task, nine task types
 * in all.
 */
export interface RecaptchaSolution extends UnmodelledFields {
  /** The value to submit to the protected site. Always returned. */
  gRecaptchaResponse: string;
  /** The matching `Sec-CH-UA` request header. */
  sec_ch_ua?: string;
  /** The `User-Agent` that goes with the token. */
  user_agent?: string;
}

/** The token returned by a FunCaptcha (Arkose Labs) task. */
export interface FunCaptchaSolution extends UnmodelledFields {
  /** The value to submit to the protected site. */
  token: string;
}

/**
 * A FunCaptcha classification result.
 *
 * The shape is not confirmed yet. No reliable sample exists, so this declares
 * no fields of its own: everything the worker returns is still on the object
 * and reachable with a bracket, and `solved.raw` keeps the untouched JSON.
 * Fields get declared as samples confirm them, and code reading them with a
 * bracket keeps working until then.
 *
 * Guessing at fields would be worse than declaring none — a wrong model reads
 * like a contract.
 */
export type FunCaptchaClassificationSolution = UnmodelledFields;

/**
 * An HCaptcha classification result.
 *
 * The shape is not confirmed yet, for the same reason as
 * {@link FunCaptchaClassificationSolution}.
 */
export type HCaptchaClassificationSolution = UnmodelledFields;

/** The token returned by a Turnstile task. */
export interface CloudflareTurnstileSolution extends UnmodelledFields {
  /** The value to submit to the protected site. */
  token: string;
  /** Request headers to replay alongside the token. */
  header?: Record<string, string>;
}

/**
 * The browser state a worker ended up with after clearing a five-second
 * interstitial.
 *
 * There is no single token here. Replaying these headers and cookies against
 * the protected site is what actually clears the challenge, which is why the
 * whole structure is kept rather than reduced to one string.
 */
export interface Cloudflare5sSolution extends UnmodelledFields {
  /** Request headers to replay. */
  header?: Record<string, string>;
  /** The clearance cookies the worker obtained. */
  cookies?: Record<string, string>;
  /** The browser fingerprint the worker used, such as `chrome149`. */
  tlsVersion?: string;
  /** The challenge page content, absent when the worker captured none. */
  body?: string;
  /**
   * The Turnstile token embedded in the challenge, absent when the flow did
   * not produce one.
   */
  sToken?: string;
}

/** The pass returned by an HCaptcha task. */
export interface HCaptchaSolution extends UnmodelledFields {
  /** The generated HCaptcha pass identifier. */
  generated_pass_UUID: string;
  /** The `User-Agent` that goes with the pass. */
  ua?: string;
  /** The language that goes with the pass. */
  lang?: string;
}

/**
 * The PerimeterX clearance cookies.
 *
 * The worker returns them as top-level fields, not nested under a cookies
 * object, and with the leading underscore their cookie names carry.
 */
export interface PerimeterXSolution extends UnmodelledFields {
  /** The `_px3` clearance cookie, the value that actually passes the check. */
  _px3: string;
  /** The `_pxvid` visitor identifier. */
  _pxvid?: string;
  /** The `_pxde` data-enrichment cookie. */
  _pxde?: string;
}

/** One round of the Akamai Web flow. */
export interface AkamaiWebSolution extends UnmodelledFields {
  /** The sensor data for this round. */
  payload: string;
  /**
   * The encoded state to feed into the next round as the task's `encodeData`.
   * Note the casing difference between the two. The round that ends the flow
   * carries none, so its absence is not a failure.
   */
  encodedata?: string;
}

/** The payload returned by an Akamai SBSD task. */
export interface AkamaiSbsdSolution extends UnmodelledFields {
  /** The base64-encoded sensor payload. */
  payload: string;
  /**
   * The `bm_lso_time` produced alongside the payload. Not every response
   * carries one.
   */
  bm_lso_time?: string;
}

/** The upstream response a TLS forwarding task fetched. */
export interface TlsForwardSolution extends UnmodelledFields {
  /** The worker's own response status. */
  status?: number;
  /** The upstream HTTP status code. */
  code?: number;
  /** The upstream response headers. */
  headers?: Record<string, unknown>;
  /** The upstream response cookies. */
  cookies?: Record<string, unknown>;
  /** The upstream response body. */
  body?: string;
}

/**
 * Returned by both DataDome challenge steps and by both DataDome task types.
 *
 * Step one carries the challenge address in `url`, step two the validation
 * instructions. Earlier workers returned step one as a bare string; it is an
 * object now, which is why both steps decode into this one type — and why
 * `solved.raw` does not narrow along with the model.
 */
export interface DataDomeSolution extends UnmodelledFields {
  /** The challenge kind, such as `slider` or `interstitial`. */
  kind?: string;
  /** The challenge URL on step one and the validation endpoint on step two. */
  url?: string;
  /** The optional validation request body. */
  body?: string;
}

/** Wraps the Reese84 payload. */
export interface IncapsulaSolution extends UnmodelledFields {
  /** The worker's inner status code. */
  status?: number;
  /**
   * The JSON string to post to the Incapsula sensor endpoint.
   *
   * It is stringified JSON and has to be submitted exactly as it arrived.
   * Parsing it here would change what the caller has to send, so the SDK
   * leaves it alone.
   */
  data: string;
}

/**
 * The result of a ReCaptcha V2 image classification task.
 *
 * `type` identifies the result kind; unknown values are preserved for the
 * caller to interpret.
 */
export interface ReClassificationSolution extends UnmodelledFields {
  /** The worker result type, usually `multi` or `single`. */
  type?: string;
  /** Whether a single image contains the requested object. */
  hasObject?: boolean;
  /** The zero-based indexes of the cells to select. */
  objects?: number[];
}

/** Whether the worker returned a multi-cell grid result. */
export function isMultiClassification(solution: ReClassificationSolution): boolean {
  return solution.type === "multi";
}

/** Whether the worker returned a single-image result. */
export function isSingleClassification(solution: ReClassificationSolution): boolean {
  return solution.type === "single";
}

/**
 * Maps each modelled task type to the solution it resolves to.
 *
 * This is what lets one `solve` call infer its own return type across all 23
 * types, replacing the per-type generic parameters the other SDKs need.
 */
export interface SolutionByTaskType {
  ReCaptchaV2TaskProxyless: RecaptchaSolution;
  ReCaptchaV2TaskProxylessS9: RecaptchaSolution;
  ReCaptchaV2STaskProxyless: RecaptchaSolution;
  ReCaptchaV2EnterpriseTaskProxyless: RecaptchaSolution;
  ReCaptchaV2SEnterpriseTaskProxyless: RecaptchaSolution;
  ReCaptchaV2Classification: ReClassificationSolution;
  ReCaptchaV3TaskProxyless: RecaptchaSolution;
  ReCaptchaV3TaskProxylessS9: RecaptchaSolution;
  ReCaptchaV3EnterpriseTaskProxyless: RecaptchaSolution;
  ReCaptchaV3EnterpriseTaskProxylessS9: RecaptchaSolution;
  FuncaptchaTaskProxyless: FunCaptchaSolution;
  FunCaptchaClassification: FunCaptchaClassificationSolution;
  PerimeterX: PerimeterXSolution;
  HCaptcha: HCaptchaSolution;
  HCaptchaClassification: HCaptchaClassificationSolution;
  AkamaiWEBTaskProxyless: AkamaiWebSolution;
  AkamaiSBSDTaskProxyless: AkamaiSbsdSolution;
  TlsTask: TlsForwardSolution;
  CloudFlare5STask: Cloudflare5sSolution;
  CloudFlareTurnstileTask: CloudflareTurnstileSolution;
  DataDomeTaskProxyless: DataDomeSolution;
  DataDomeTagsTaskProxyless: DataDomeSolution;
  IncapsulaTaskProxyless: IncapsulaSolution;
}

/**
 * The solution a task type resolves to.
 *
 * A type this release does not model resolves to {@link UnmodelledFields}, so
 * a brand-new task type still returns something readable rather than failing
 * to compile.
 */
export type SolutionFor<T extends string> = T extends KnownTaskType
  ? SolutionByTaskType[T]
  : UnmodelledFields;

/**
 * Fields the service has confirmed a worker always returns.
 *
 * A missing one is a decoding failure rather than an `undefined` typed as
 * `string`: a model that silently hands back a missing token is worse than no
 * model, because the caller submits an empty value and cannot tell why.
 *
 * Python gets this check for free — a missing keyword argument fails in the
 * dataclass constructor — and Go gets it from a struct tag. TypeScript erases
 * its types at runtime, so the check has to be written out. It stays at
 * *presence and type*, matching what the other two actually enforce; an empty
 * string is a worker's answer, not a broken response.
 */
const REQUIRED_SOLUTION_FIELDS: Readonly<Partial<Record<KnownTaskType, readonly string[]>>> = {
  ReCaptchaV2TaskProxyless: ["gRecaptchaResponse"],
  ReCaptchaV2TaskProxylessS9: ["gRecaptchaResponse"],
  ReCaptchaV2STaskProxyless: ["gRecaptchaResponse"],
  ReCaptchaV2EnterpriseTaskProxyless: ["gRecaptchaResponse"],
  ReCaptchaV2SEnterpriseTaskProxyless: ["gRecaptchaResponse"],
  ReCaptchaV3TaskProxyless: ["gRecaptchaResponse"],
  ReCaptchaV3TaskProxylessS9: ["gRecaptchaResponse"],
  ReCaptchaV3EnterpriseTaskProxyless: ["gRecaptchaResponse"],
  ReCaptchaV3EnterpriseTaskProxylessS9: ["gRecaptchaResponse"],
  FuncaptchaTaskProxyless: ["token"],
  CloudFlareTurnstileTask: ["token"],
  HCaptcha: ["generated_pass_UUID"],
  PerimeterX: ["_px3"],
  AkamaiWEBTaskProxyless: ["payload"],
  AkamaiSBSDTaskProxyless: ["payload"],
  IncapsulaTaskProxyless: ["data"],
};

/**
 * Checks the fields a worker is known to always return, and hands the solution
 * back unchanged.
 *
 * Nothing is copied or renamed: the decoded object is already the lossless
 * representation. This only rejects a shape that would read as a contract
 * while being empty.
 *
 * @throws SolutionDecodeError when a confirmed field is missing or not a string.
 * @internal
 */
export function decodeSolution<T extends string>(
  taskType: T,
  value: unknown,
  raw: string,
): SolutionFor<T> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SolutionDecodeError(raw, `expected a JSON object, got ${describeJsonType(value)}`);
  }

  const required = REQUIRED_SOLUTION_FIELDS[taskType as KnownTaskType];
  if (required) {
    const record = value as Record<string, unknown>;
    for (const field of required) {
      if (!(field in record)) {
        throw new SolutionDecodeError(raw, `missing required field ${JSON.stringify(field)}`);
      }
      if (typeof record[field] !== "string") {
        throw new SolutionDecodeError(
          raw,
          `required field ${JSON.stringify(field)} is ${describeJsonType(record[field])}, ` +
            "expected a string",
        );
      }
    }
  }
  return value as SolutionFor<T>;
}

/** Names a JSON value's type for an error message. */
function describeJsonType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return value === "" ? "an empty string" : "a string";
  return `a ${typeof value}`;
}
