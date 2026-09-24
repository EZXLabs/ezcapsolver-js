/**
 * Task parameter models.
 *
 * ## Field names are the service's own
 *
 * Python declares a `wire()` name for every field and Go carries a `json` tag,
 * because both rename the service's camelCase into their own conventions.
 * TypeScript shares the service's convention already, so the fields here *are*
 * the wire names — `websiteURL`, `funcaptchaApiJSSubdomain`, `html_b64` and
 * the rest, irregularities included. There is no mapping table to keep in
 * sync, and what you write is what is sent.
 *
 * ## Why `extra` exists here but not on solutions
 *
 * Solutions are received, so openness is what serves the caller: every field
 * a worker returns stays on the object. Tasks are authored, so strictness is
 * what serves them: TypeScript's excess-property check turns `websiteUrl`
 * into a compile error. Passthrough parameters therefore go in an explicit
 * {@link TaskExtra.extra}, which is merged into the task object — the same
 * shape Rust, Go and Python use.
 *
 * @module
 */

import type { KnownTaskType } from "./task-type.js";

/**
 * A task type's parameters, plus any the caller wants to pass straight through
 * to the worker.
 *
 * This is what the named methods take, so a parameter this release does not
 * model goes inline next to the ones it does:
 *
 * ```ts
 * await client.solveReCaptchaV2TaskProxyless({
 *   websiteURL: "https://example.com",
 *   websiteKey: "6Lc...",
 *   someNewParam: 1,        // written inline, not nested under extra
 * });
 * ```
 *
 * The trade is deliberate and worth knowing: an index signature switches off
 * TypeScript's excess-property check, so a misspelled *optional* parameter
 * (`websiteUrl`) is accepted as a custom one instead of being flagged.
 * Required parameters and the types of declared ones are still enforced.
 *
 * {@link TaskExtra.extra} stays available for callers who would rather keep
 * pass-through parameters visibly separate, and the generic `solve` form is
 * unchanged.
 */
export type WithExtras<P> = P & Record<string, unknown>;

/** Carried by every task model. */
export interface TaskExtra {
  /**
   * Parameters this release does not model, merged into the task object.
   *
   * Declared parameters win over a duplicate key here, and the task type
   * always wins over both — a `type` in here cannot change what gets billed.
   */
  extra?: Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// ReCaptcha
// ---------------------------------------------------------------------------

/**
 * ReCaptcha V2, proxyless.
 *
 * Backs five task types: the plain, high-score S9, `s`-parameter, Enterprise
 * and Enterprise `s` variants.
 */
export interface ReCaptchaV2Params extends TaskExtra {
  /** URL of the page containing the challenge. */
  websiteURL: string;
  /** ReCaptcha site key. */
  websiteKey: string;
  /** Whether the challenge uses invisible mode. */
  isInvisible?: boolean | undefined;
  /** Optional security anchor parameter. */
  sa?: string | undefined;
  /** Optional challenge-bound `s` parameter. */
  s?: string | undefined;
  /** Optional page title. */
  websiteTitle?: string | undefined;
  /** Optional proxy forwarded to the worker. */
  proxy?: string | undefined;
}

/**
 * ReCaptcha V3, proxyless.
 *
 * Backs four task types: the plain, high-score S9, Enterprise and Enterprise
 * S9 variants.
 */
export interface ReCaptchaV3Params extends TaskExtra {
  /** URL of the page containing the challenge. */
  websiteURL: string;
  /** ReCaptcha site key. */
  websiteKey: string;
  /**
   * Whether the challenge uses invisible mode.
   *
   * The service defaults this to `true` for V3, so leaving it out is not the
   * same as passing `false`.
   */
  isInvisible?: boolean | undefined;
  /** Action configured by the protected page. */
  pageAction?: string | undefined;
  /** Optional page title. */
  websiteTitle?: string | undefined;
  /** Site-specific check field. */
  checkField?: string | undefined;
  /** Optional proxy forwarded to the worker. */
  proxy?: string | undefined;
}

/** ReCaptcha V2 image classification. */
export interface ReCaptchaV2ClassificationParams extends TaskExtra {
  /** Base64-encoded challenge image. */
  image: string;
  /** Object identifier or classification question. */
  question: string;
  /** Grid size documented by the service. Defaults to 4 service-side. */
  size?: number | undefined;
}

// ---------------------------------------------------------------------------
// FunCaptcha
// ---------------------------------------------------------------------------

/** FunCaptcha (Arkose Labs), proxyless. */
export interface FunCaptchaParams extends TaskExtra {
  /** URL of the page containing the challenge. */
  websiteURL: string;
  /** FunCaptcha public key. */
  websiteKey: string;
  /** Optional Arkose Labs blob, a JSON string shaped like `{"blob":"..."}`. */
  data?: string | undefined;
  /** Optional arkoselabs.com subdomain the site uses. */
  funcaptchaApiJSSubdomain?: string | undefined;
  /**
   * Optional worker proxy.
   *
   * FunCaptcha is the only task type using the `FUN` proxy format —
   * `protocol://host:port:username:password`, with the credentials appended
   * rather than placed before the host. Every other type takes
   * `protocol://username:password@host:port`.
   *
   * Either way the service requires both a username and a password: an
   * unauthenticated proxy is rejected.
   */
  proxy?: string | undefined;
  /** Whether the supplied proxy is inside mainland China. */
  cn?: boolean | undefined;
}

/**
 * FunCaptcha image classification.
 *
 * This type's solution shape is not confirmed yet, so its solution declares no
 * fields — read the worker's output with a bracket.
 */
export interface FunCaptchaClassificationParams extends TaskExtra {
  /** Base64-encoded challenge image. */
  image: string;
  /** Classification question. */
  question: string;
}

// ---------------------------------------------------------------------------
// HCaptcha
// ---------------------------------------------------------------------------

/** HCaptcha. */
export interface HCaptchaParams extends TaskExtra {
  /** URL of the page containing the challenge. */
  websiteURL: string;
  /** HCaptcha site key. */
  websiteKey: string;
  /** Browser language. Only `en-US` is supported at the moment. */
  lang: string;
  /**
   * Whether the challenge runs without a visible checkbox. True when the site
   * shows no HCaptcha checkbox, false when it does.
   */
  invisible: boolean;
  /** Optional proxy forwarded to the worker. */
  proxy?: string | undefined;
  /**
   * Optional `rqdata` value, required by the sites that publish one.
   *
   * The name is all lowercase here, unlike {@link Cloudflare5sParams.rqData},
   * which carries an object rather than a string. The two are not
   * interchangeable.
   */
  rqdata?: string | undefined;
}

/**
 * HCaptcha image classification.
 *
 * Every field is optional: different classification modules need different
 * input combinations, and the service contract does not yet state which are
 * required.
 */
export interface HCaptchaClassificationParams extends TaskExtra {
  /** Optional single image. */
  image?: string | undefined;
  /** Optional image collection. */
  images?: string[] | undefined;
  /** Optional anchor collection. */
  anchors?: string[] | undefined;
  /** Optional classification question. */
  question?: string | undefined;
  /** Optional classification module. */
  module?: string | undefined;
}

// ---------------------------------------------------------------------------
// PerimeterX
// ---------------------------------------------------------------------------

/** PerimeterX. */
export interface PerimeterXParams extends TaskExtra {
  /** PerimeterX application identifier. */
  websiteKey: string;
  /** Whether the challenge uses invisible mode. */
  invisible?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Akamai
// ---------------------------------------------------------------------------

/**
 * Akamai Web, proxyless.
 *
 * A multi-round flow: each round feeds the previous round's `encodedata` into
 * {@link AkamaiWebParams.encodeData} and increments {@link AkamaiWebParams.index}.
 */
export interface AkamaiWebParams extends TaskExtra {
  /** URL of the page the Akamai script belongs to. */
  pageUrl: string;
  /**
   * URL of the Akamai v3 script.
   *
   * Most sites change this URL on every request, so it has to be read from the
   * page rather than hard-coded. It is the URL itself, not the script the URL
   * serves.
   */
  v3Url: string;
  /** Browser User-Agent. */
  ua: string;
  /** Browser language. */
  lang: string;
  /** Current interaction round. */
  index?: number | undefined;
  /**
   * Current `_abck` cookie value. Empty on the first round, which runs before
   * the site has issued one.
   */
  abck?: string | undefined;
  /** Current `bm_sz` cookie value, empty on the first round. */
  bmsz?: string | undefined;
  /**
   * Base64-encoded Akamai script. Only the first round sends it; later rounds
   * leave it empty.
   */
  script_base64?: string | undefined;
  /** Encoded state returned by the previous round. */
  encodeData?: string | undefined;
}

/** Akamai SBSD, proxyless. */
export interface AkamaiSbsdParams extends TaskExtra {
  /** URL of the page the challenge belongs to. */
  pageUrl: string;
  /** URL of the SBSD script. */
  sbsdUrl: string;
  /** Existing `bm_so` or equivalent cookie value. */
  bmSo: string;
  /** Browser User-Agent. */
  ua: string;
  /** Browser language. */
  lang: string;
  /** Base64-encoded SBSD script. */
  script_base64: string;
}

// ---------------------------------------------------------------------------
// Cloudflare
// ---------------------------------------------------------------------------

/** Cloudflare five-second challenge. */
export interface Cloudflare5sParams extends TaskExtra {
  /** URL protected by the challenge. */
  websiteURL: string;
  /**
   * Proxy the challenge worker uses. **Required for this type**, unlike most
   * others.
   *
   * Format is `protocol://username:password@host:port` with protocol one of
   * `http`, `https` or `socks5`. Both credentials are required — the service
   * rejects an unauthenticated proxy — and the host may not be a private
   * address such as `127.0.*`, `192.168.*`, `172.16.*` or `10.0.*`.
   */
  proxy: string;
  /** Optional challenge request data. */
  rqData?: Record<string, unknown> | undefined;
}

/** Cloudflare Turnstile. */
export interface CloudflareTurnstileParams extends TaskExtra {
  /** URL of the page containing the Turnstile widget. */
  websiteURL: string;
  /** Turnstile site key. */
  websiteKey: string;
  /**
   * Optional worker proxy, as `protocol://username:password@host:port`. Both
   * credentials are required and the host may not be a private address.
   */
  proxy?: string | undefined;
  /** Optional Turnstile metadata. */
  rqData?: Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// DataDome
// ---------------------------------------------------------------------------

/** DataDome challenge step. */
export type DataDomeStep = "1" | "2";

/** JavaScript mode for DataDome tags. */
export type DataDomeJsType = "ch" | "le";

/**
 * DataDome challenge, proxyless.
 *
 * Both steps return a `DataDomeSolution`: step one carries the challenge
 * address in `url`, step two the validation instructions.
 */
export interface DataDomeParams extends TaskExtra {
  /** Base64-encoded challenge HTML. */
  html_b64: string;
  /** Step of the challenge workflow. Defaults to `"1"`. */
  step?: DataDomeStep | undefined;
  /** Optional base64-encoded image. */
  image?: string | undefined;
  /** Optional page or challenge URL. */
  referer?: string | undefined;
  /** Optional parent page URL. */
  parent_url?: string | undefined;
  /** Optional equipment identifier. */
  equipment?: string | undefined;
}

/** DataDome tags, proxyless. */
export interface DataDomeTagsParams extends TaskExtra {
  /** DataDome JavaScript key. */
  ddk: string;
  /** DataDome JavaScript mode. Defaults to `"ch"`. */
  jstype?: DataDomeJsType | undefined;
  /** Session identifier; an empty string is valid. */
  cid?: string | undefined;
  /** One-based packet counter. Defaults to 1. */
  bpc?: number | undefined;
  /** Current page URL. */
  referer: string;
  /** Browser User-Agent. */
  ua: string;
  /** External business fields forwarded to the worker. */
  fields?: Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Incapsula
// ---------------------------------------------------------------------------

/** Incapsula Reese84, proxyless. */
export interface IncapsulaParams extends TaskExtra {
  /** Full source of the Reese84 sensor script. */
  script: string;
  /** URL of the sensor script. */
  scriptUrl: string;
  /** URL of the page executing the sensor script. */
  pageUrl: string;
  /** Optional Accept-Language header used by the browser flow. */
  acceptLanguage?: string | undefined;
  /** Browser User-Agent. */
  ua: string;
  /** Optional proxy used by the worker. */
  proxy?: string | undefined;
  /**
   * Optional proof-of-work data, required by the sites that have PoW
   * challenges enabled.
   */
  pow?: string | undefined;
}

// ---------------------------------------------------------------------------
// TLS forwarding
// ---------------------------------------------------------------------------

/** HTTP methods accepted by TLS forwarding tasks. */
export type TlsHttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** Forward one HTTP request through the worker's TLS fingerprint. */
export interface TlsForwardParams extends TaskExtra {
  /** The worker's TLS fingerprint identifier. */
  tls_type: string;
  /** Proxy used for the upstream request. */
  proxy: string;
  /** Upstream HTTP method. Defaults to `"GET"`. */
  method?: TlsHttpMethod | undefined;
  /** Upstream URL. */
  url: string;
  /** Optional upstream request headers. */
  headers?: Record<string, unknown> | undefined;
  /** Optional serialised header order. */
  headers_order?: string | undefined;
  /** Optional upstream request cookies. */
  cookies?: Record<string, unknown> | undefined;
  /** Optional upstream request body. */
  body?: unknown | undefined;
  /**
   * Whether {@link TlsForwardParams.body} is already base64-encoded. Defaults
   * to `false`, which is sent rather than omitted so the worker never has to
   * guess.
   */
  body_raw?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Type-level wiring
// ---------------------------------------------------------------------------

/**
 * Maps each modelled task type to its parameters.
 *
 * Several types share one model where the parameters are the same — the five
 * ReCaptcha V2 variants are one model, the four V3 variants another.
 */
export interface ParamsByTaskType {
  ReCaptchaV2TaskProxyless: ReCaptchaV2Params;
  ReCaptchaV2TaskProxylessS9: ReCaptchaV2Params;
  ReCaptchaV2STaskProxyless: ReCaptchaV2Params;
  ReCaptchaV2EnterpriseTaskProxyless: ReCaptchaV2Params;
  ReCaptchaV2SEnterpriseTaskProxyless: ReCaptchaV2Params;
  ReCaptchaV2Classification: ReCaptchaV2ClassificationParams;
  ReCaptchaV3TaskProxyless: ReCaptchaV3Params;
  ReCaptchaV3TaskProxylessS9: ReCaptchaV3Params;
  ReCaptchaV3EnterpriseTaskProxyless: ReCaptchaV3Params;
  ReCaptchaV3EnterpriseTaskProxylessS9: ReCaptchaV3Params;
  FuncaptchaTaskProxyless: FunCaptchaParams;
  FunCaptchaClassification: FunCaptchaClassificationParams;
  PerimeterX: PerimeterXParams;
  HCaptcha: HCaptchaParams;
  HCaptchaClassification: HCaptchaClassificationParams;
  AkamaiWEBTaskProxyless: AkamaiWebParams;
  AkamaiSBSDTaskProxyless: AkamaiSbsdParams;
  TlsTask: TlsForwardParams;
  CloudFlare5STask: Cloudflare5sParams;
  CloudFlareTurnstileTask: CloudflareTurnstileParams;
  DataDomeTaskProxyless: DataDomeParams;
  DataDomeTagsTaskProxyless: DataDomeTagsParams;
  IncapsulaTaskProxyless: IncapsulaParams;
}

/**
 * The parameters a task type takes.
 *
 * A type this release does not model accepts any parameters, so a brand-new
 * task type works without waiting for an SDK update.
 */
export type ParamsFor<T extends string> = T extends KnownTaskType
  ? ParamsByTaskType[T]
  : Record<string, unknown> & TaskExtra;

/**
 * A task to solve: its type plus that type's parameters.
 *
 * The `type` field is both the discriminator TypeScript narrows on and the
 * value sent on the wire, so the object you write is the object that goes out.
 */
export type Task<T extends string = string> = { type: T } & ParamsFor<T>;

/**
 * Values the service requires but does not default for itself.
 *
 * These fields are validated against a closed set server-side, so omitting one
 * is rejected rather than defaulted. Go substitutes them in three separate
 * `MarshalJSON` overrides and Python in dataclass defaults; collecting them
 * here keeps the reason in one readable place.
 *
 * Anything the service *does* default — `size`, V3's `isInvisible` — is
 * deliberately absent: leaving those out lets the service apply its own value,
 * which is what an omitted optional should mean.
 */
const TASK_DEFAULTS: Readonly<Partial<Record<KnownTaskType, Readonly<Record<string, unknown>>>>> = {
  DataDomeTaskProxyless: { step: "1", image: "" },
  DataDomeTagsTaskProxyless: { jstype: "ch", cid: "", bpc: 1, fields: {} },
  // body_raw is sent even when false: the other SDKs always send it, and an
  // absent flag would leave the worker guessing how `body` is encoded.
  TlsTask: { method: "GET", body_raw: false },
  // Round 0 runs before _abck and bm_sz exist, and the script is only sent on
  // that round. The contract marks these optional with an empty-string default,
  // so supplying it here saves every caller from writing "" by hand.
  AkamaiWEBTaskProxyless: {
    index: 0,
    abck: "",
    bmsz: "",
    script_base64: "",
    encodeData: "",
  },
};

/**
 * Splits a task into the parameters to send, applying the service's required
 * defaults.
 *
 * `extra` is merged first so a declared parameter always wins over a
 * passthrough key of the same name — an accidental duplicate must not silently
 * replace an explicit parameter.
 *
 * @internal
 */
export function taskParams(task: Task<string>): Record<string, unknown> {
  const { type, extra, ...declared } = task as {
    type: string;
    extra?: Record<string, unknown> | undefined;
  };
  const params: Record<string, unknown> = {
    ...TASK_DEFAULTS[type as KnownTaskType],
    ...extra,
    ...declared,
  };
  // An optional explicitly set to undefined means the same as omitting it, so
  // it does not belong in the request.
  for (const key of Object.keys(params)) {
    if (params[key] === undefined) delete params[key];
  }
  return params;
}
