<div align="center">
  <img src="https://raw.githubusercontent.com/EZXLabs/ezcapsolver-js/main/assets/ez-captcha-logo.svg" alt="EZCaptchaSolver by EZXLabs" height="88">
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/EZXLabs/ezcapsolver-js/main/assets/js.svg" alt="JavaScript" height="88">
  <h1>EZCaptchaSolver JavaScript SDK</h1>
  <p>
    <a href="https://github.com/EZXLabs/ezcapsolver-js/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/EZXLabs/ezcapsolver-js/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://www.npmjs.com/package/ezcapsolver-js"><img alt="npm" src="https://img.shields.io/npm/v/ezcapsolver-js.svg"></a>
    <a href="https://github.com/EZXLabs/ezcapsolver-js/blob/main/LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
    <a href="https://nodejs.org"><img alt="Node 22.12+" src="https://img.shields.io/badge/node-22.12%2B-339933.svg?logo=node.js&logoColor=white"></a>
    <a href="https://www.typescriptlang.org"><img alt="TypeScript" src="https://img.shields.io/badge/types-included-3178C6.svg?logo=typescript&logoColor=white"></a>
    <a href="https://ezxlabs.com"><img alt="EZXLabs website" src="https://img.shields.io/badge/website-ezxlabs.com-FFDB29?logoColor=black"></a>
  </p>
  <p>
    <a href="https://ezxlabs.com">🌐 Official website</a> &nbsp;·&nbsp;
    <a href="https://docs.ezxlabs.com/docs/captcha/api">📚 EZCaptchaSolver API reference</a> &nbsp;·&nbsp;
    <a href="https://github.com/EZXLabs/ezcapsolver-js/tree/main/examples">🧪 Examples</a> &nbsp;·&nbsp;
    <a href="#-supported-captcha-types">🧩 Captcha Types</a>
  </p>
  <p><b>English</b> &nbsp;·&nbsp; <a href="https://github.com/EZXLabs/ezcapsolver-js/blob/main/README.zh-CN.md">简体中文</a></p>
</div>

---

The EZCaptchaSolver JavaScript SDK is an open-source JavaScript and TypeScript client maintained by [EZXLabs](https://ezxlabs.com) for its CAPTCHA recognition task API. It provides typed requests and a Promise-based client for the supported task types below; the package also includes a TLS forwarding task that does not solve CAPTCHAs. For the wider SDK family, see the [EZCaptchaSolver SDK product page](https://ezxlabs.com/products/sdk); for HTTP request and response fields, see the [EZCaptchaSolver API reference](https://docs.ezxlabs.com/docs/captcha/api); for JavaScript usage, see the [examples in this repository](https://github.com/EZXLabs/ezcapsolver-js/blob/main/examples/README.md).

**Zero runtime dependencies.** Built on the platform `fetch`, so it runs on Node, Deno, Bun and edge runtimes alike.

## 🧩 Supported Captcha Types

Captcha task types come in a synchronous and an asynchronous form:

- **Synchronous**: the request blocks after the task is created and returns once the task is done.
- **Asynchronous**: creating the task returns a task ID, and the result is fetched later by polling that ID. This suits captcha types that take a while to solve.

A captcha type can support both forms at once, and almost every type supports the synchronous one. A few types are asynchronous only.

Every type has two methods: `solveX` creates the task and polls for the result, `syncSolveX` runs it through the synchronous endpoint. Both return a promise — `sync` names the endpoint, not the calling convention.

### reCAPTCHA v2

| Task type | Modes | Example | Description |
| :-: | :-: | :-: | --- |
| `ReCaptchaV2TaskProxyless` | all | [Example](#task-recaptchav2taskproxyless) | reCAPTCHA v2 |
| `ReCaptchaV2TaskProxylessS9` | all | [Example](#task-recaptchav2taskproxylesss9) | reCAPTCHA v2, returns a token scored ≥ 0.9 |
| `ReCaptchaV2STaskProxyless` | all | [Example](#task-recaptchav2staskproxyless) | reCAPTCHA v2 carrying the challenge-bound `s` parameter |
| `ReCaptchaV2EnterpriseTaskProxyless` | all | [Example](#task-recaptchav2enterprisetaskproxyless) | reCAPTCHA v2 Enterprise |
| `ReCaptchaV2SEnterpriseTaskProxyless` | all | [Example](#task-recaptchav2senterprisetaskproxyless) | reCAPTCHA v2 Enterprise with the `s` parameter |
| `ReCaptchaV2Classification` | sync | [Example](#task-recaptchav2classification) | Image classification for a reCAPTCHA v2 grid |

### reCAPTCHA v3

| Task type | Modes | Example | Description |
| :-: | :-: | :-: | --- |
| `ReCaptchaV3TaskProxyless` | all | [Example](#task-recaptchav3taskproxyless) | reCAPTCHA v3 |
| `ReCaptchaV3TaskProxylessS9` | all | [Example](#task-recaptchav3taskproxylesss9) | reCAPTCHA v3, returns a token scored ≥ 0.9 |
| `ReCaptchaV3EnterpriseTaskProxyless` | all | [Example](#task-recaptchav3enterprisetaskproxyless) | reCAPTCHA v3 Enterprise |
| `ReCaptchaV3EnterpriseTaskProxylessS9` | all | [Example](#task-recaptchav3enterprisetaskproxylesss9) | reCAPTCHA v3 Enterprise, scored ≥ 0.9 |

### FunCaptcha / Arkose Labs

| Task type | Modes | Example | Description |
| :-: | :-: | :-: | --- |
| `FuncaptchaTaskProxyless` | all | [Example](#task-funcaptchataskproxyless) | FunCaptcha token |
| `FunCaptchaClassification` | sync | [Example](#task-funcaptchaclassification) | Image classification for a FunCaptcha challenge |

### hCaptcha

| Task type | Modes | Example | Description |
| :-: | :-: | :-: | --- |
| `HCaptcha` | all | [Example](#task-hcaptcha) | hCaptcha pass |
| `HCaptchaClassification` | sync | [Example](#task-hcaptchaclassification) | Image classification for an hCaptcha challenge |

### Cloudflare

| Task type | Modes | Example | Description |
| :-: | :-: | :-: | --- |
| `CloudFlareTurnstileTask` | all | [Example](#task-cloudflareturnstiletask) | Turnstile token |
| `CloudFlare5STask` | all | [Example](#task-cloudflare5stask) | Five-second interstitial; returns browser state, not a token |

### Akamai

| Task type | Modes | Example | Description |
| :-: | :-: | :-: | --- |
| `AkamaiWEBTaskProxyless` | sync | [Example](#task-akamaiwebtaskproxyless) | Akamai Web sensor payload, one round at a time |
| `AkamaiSBSDTaskProxyless` | sync | [Example](#task-akamaisbsdtaskproxyless) | Akamai SBSD sensor payload |

### DataDome

| Task type | Modes | Example | Description |
| :-: | :-: | :-: | --- |
| `DataDomeTaskProxyless` | sync | [Example](#task-datadometaskproxyless) | DataDome challenge, both steps |
| `DataDomeTagsTaskProxyless` | sync | [Example](#task-datadometagstaskproxyless) | DataDome tags payload |

### Other

| Task type | Modes | Example | Description |
| :-: | :-: | :-: | --- |
| `PerimeterX` | all | [Example](#task-perimeterx) | PerimeterX (Press & Hold) clearance cookies |
| `IncapsulaTaskProxyless` | sync | [Example](#task-incapsulataskproxyless) | Incapsula Reese84 sensor payload |
| `TlsTask` | sync | [Example](#task-tlstask) | Forward one HTTP request through the worker's TLS fingerprint |

## 📦 Installation

```bash
npm install ezcapsolver-js
pnpm add ezcapsolver-js
yarn add ezcapsolver-js
bun add ezcapsolver-js
```

**Node 22.12 or newer.** The package ships both ESM and CommonJS builds with their own type declarations, so `import` and `require` both work:

```ts
import { EzCapSolverClient } from "ezcapsolver-js";      // ESM
const { EzCapSolverClient } = require("ezcapsolver-js"); // CommonJS
```

TypeScript types are included; there is no `@types/` package to install.

## 🚀 Quick Start

```ts
import { EzCapSolverClient } from "ezcapsolver-js";

// Reads EZCAPTCHA_API_KEY from the environment when no key is passed.
const client = new EzCapSolverClient({ clientKey: "your-client-key" });

const solved = await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://www.google.com/recaptcha/api2/demo",
  websiteKey: "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
});

console.log(solved.solution.gRecaptchaResponse);
console.log(await client.getBalance());
```

## 📖 Usage

### Two endpoints, one method pair

```ts
// Create the task, then poll until a worker finishes it.
const solved = await client.solveHCaptcha({ websiteURL, websiteKey });

// The synchronous endpoint, which answers on the creating request.
const solved = await client.syncSolveHCaptcha({ websiteURL, websiteKey });
```

Both are asynchronous JavaScript. The difference is which service endpoint is used: `solve` creates a task and polls `/getTaskResult`, `syncSolve` posts to `/createSyncTask` and gets the answer back on that request.

Use the mode listed in the tables above when there is no reason to prefer the other — the service may reject a type on the endpoint it does not serve, and that rejection costs a round trip rather than a task.

### Proxy format

Two formats are in play, and picking the wrong one is rejected:

| Format | Shape | Used by |
| --- | --- | --- |
| `NORMAL` | `protocol://username:password@host:port` | every type except FunCaptcha |
| `FUN` | `protocol://host:port:username:password` | `FuncaptchaTaskProxyless` only |

`protocol` is one of `http`, `https` or `socks5`. **Both credentials are required** — the service rejects an unauthenticated proxy — and the host may not be a private address such as `127.0.*`, `192.168.*`, `172.16.*` or `10.0.*`.

This is the proxy the *worker* uses to reach the protected site. For routing the SDK's own traffic through a proxy, see [Configuration](#-configuration).

### reCAPTCHA v2

[reCAPTCHA v2 API reference](https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v2)

The first five types share one parameter model and one solution model; only the method name differs.

<a id="task-recaptchav2taskproxyless"></a>

#### ReCaptchaV2TaskProxyless

```ts
const solved = await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
});

console.log(solved.taskId);
console.log(solved.solution.gRecaptchaResponse);
```

<a id="task-recaptchav2taskproxylesss9"></a>

#### ReCaptchaV2TaskProxylessS9

Identical parameters to plain v2; runs on the high-score queue and returns a token scored ≥ 0.9.

```ts
const solved = await client.solveReCaptchaV2TaskProxylessS9({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
});
```

<a id="task-recaptchav2staskproxyless"></a>

#### ReCaptchaV2STaskProxyless

Carries the challenge-bound `s` parameter. It is not mandatory; without it the behaviour matches plain v2.

```ts
const solved = await client.solveReCaptchaV2STaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
  s: "value-from-the-page",
});
```

<a id="task-recaptchav2enterprisetaskproxyless"></a>

#### ReCaptchaV2EnterpriseTaskProxyless

```ts
const solved = await client.solveReCaptchaV2EnterpriseTaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_enterprise_key",
});
```

<a id="task-recaptchav2senterprisetaskproxyless"></a>

#### ReCaptchaV2SEnterpriseTaskProxyless

```ts
const solved = await client.solveReCaptchaV2SEnterpriseTaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_enterprise_key",
  s: "value-from-the-page",
});
```

<a id="task-recaptchav2classification"></a>

#### ReCaptchaV2Classification

Runs on the synchronous endpoint. `size` is the grid width: `1` for a single image, `3` or `4` for a grid.

```ts
import { isMultiClassification, isSingleClassification } from "ezcapsolver-js";

const solved = await client.syncSolveReCaptchaV2Classification({
  image: base64EncodedImage,
  question: "/m/014xcs", // Google object identifier; this one is "crosswalk"
  size: 3,
});

const { solution } = solved;
if (isMultiClassification(solution)) {
  console.log(solution.objects); // zero-based indexes of the cells to click
} else if (isSingleClassification(solution)) {
  console.log(solution.hasObject);
}
```

### reCAPTCHA v3

[reCAPTCHA v3 API reference](https://docs.ezxlabs.com/docs/captcha/api/recaptcha-v3)

`pageAction` has to match the action the protected page grades against.

<a id="task-recaptchav3taskproxyless"></a>

#### ReCaptchaV3TaskProxyless

```ts
const solved = await client.solveReCaptchaV3TaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
  pageAction: "examples/v3scores",
});
```

<a id="task-recaptchav3taskproxylesss9"></a>

#### ReCaptchaV3TaskProxylessS9

```ts
const solved = await client.solveReCaptchaV3TaskProxylessS9({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
  pageAction: "examples/v3scores",
});
```

<a id="task-recaptchav3enterprisetaskproxyless"></a>

#### ReCaptchaV3EnterpriseTaskProxyless

```ts
const solved = await client.solveReCaptchaV3EnterpriseTaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_enterprise_key",
  pageAction: "examples/v3scores",
});
```

<a id="task-recaptchav3enterprisetaskproxylesss9"></a>

#### ReCaptchaV3EnterpriseTaskProxylessS9

The task catalog writes this one as `RecaptchaV3EnterpriseTaskProxylessS9`. The SDK normalises it to match the rest of the ReCaptcha family; the service matches task types case-insensitively, so both reach the same worker.

```ts
const solved = await client.solveReCaptchaV3EnterpriseTaskProxylessS9({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_enterprise_key",
  pageAction: "examples/v3scores",
});
```

### FunCaptcha / Arkose Labs

[FunCaptcha API reference](https://docs.ezxlabs.com/docs/captcha/api/funcaptcha)

<a id="task-funcaptchataskproxyless"></a>

#### FuncaptchaTaskProxyless

Remember the `FUN` proxy format for this type, and note the lowercase `c` in the wire name.

```ts
const solved = await client.solveFuncaptchaTaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "your_public_key",
  data: '{"blob":"..."}', // Arkose Labs blob, when the page produces one
  proxy: "http://host:8080:user:pass",
});

console.log(solved.solution.token);
```

<a id="task-funcaptchaclassification"></a>

#### FunCaptchaClassification

The result shape of this type is unconfirmed. Every field the worker returns is on the solution object; read it with a bracket.

```ts
const solved = await client.syncSolveFunCaptchaClassification({
  image: base64EncodedImage,
  question: "Pick the image that is the correct way up",
});

console.log(solved.raw);
```

### hCaptcha

[hCaptcha API reference](https://docs.ezxlabs.com/docs/captcha/api/hcaptcha)

<a id="task-hcaptcha"></a>

#### HCaptcha

```ts
const solved = await client.solveHCaptcha({
  websiteURL: "https://accounts.hcaptcha.com/demo",
  websiteKey: "a5f74b19-9e45-40e0-b45d-47ff91b7a6c2",
  lang: "en-US",
  invisible: false, // true on sites that show no checkbox
  rqdata: process.env["EZCAPTCHA_HCAPTCHA_RQDATA"], // lower case, unlike Cloudflare's rqData
});

console.log(solved.solution.generated_pass_UUID);
console.log(solved.solution.ua); // requests carrying the pass must send this User-Agent
```

<a id="task-hcaptchaclassification"></a>

#### HCaptchaClassification

The shape is unconfirmed here too.

```ts
const solved = await client.syncSolveHCaptchaClassification({
  image: base64EncodedImage,
  question: "Please click each image containing a crosswalk",
});
```

### Cloudflare

<a id="task-cloudflareturnstiletask"></a>

#### CloudFlareTurnstileTask

[Cloudflare Turnstile API reference](https://docs.ezxlabs.com/docs/captcha/api/turnstile)

```ts
const solved = await client.solveCloudFlareTurnstileTask({
  websiteURL: "https://example.com",
  websiteKey: "0x4AAAAAAA...", // Turnstile site keys start with 0x
});

console.log(solved.solution.token);
```

<a id="task-cloudflare5stask"></a>

#### CloudFlare5STask

[Cloudflare 5S API reference](https://docs.ezxlabs.com/docs/captcha/api/cloudflare-5s)

There is no single token here. Replaying the headers and cookies against the protected site is what clears the challenge, which is why the whole browser state comes back. `proxy` is **required** for this type, and the replay has to go through the same proxy or the clearance is rejected.

```ts
const solved = await client.solveCloudFlare5STask({
  websiteURL: "https://example.com",
  proxy: "http://user:pass@host:8080",
});

const { header, cookies, tlsVersion } = solved.solution;
```

### Akamai

<a id="task-akamaiwebtaskproxyless"></a>

#### AkamaiWEBTaskProxyless

[Akamai Web API reference](https://docs.ezxlabs.com/docs/captcha/api/akamai-web)

A multi-round flow: feed each round's `encodedata` into the next round's `encodeData` and increment `index`. The round that ends the flow returns no further state.

```ts
let encodeData = "";

for (let index = 0; index < 5; index++) {
  const solved = await client.syncSolveAkamaiWEBTaskProxyless({
    pageUrl: "https://example.com",
    v3Url: "https://example.com/v3/...",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
    lang: "en-GB",
    index,
    abck: "_abck_cookie_value",
    bmsz: "bm_sz_cookie_value",
    script_base64: index === 0 ? base64EncodedScript : "",
    encodeData,
  });

  encodeData = solved.solution.encodedata ?? "";
  if (encodeData === "") break;
}
```

<a id="task-akamaisbsdtaskproxyless"></a>

#### AkamaiSBSDTaskProxyless

[Akamai SBSD API reference](https://docs.ezxlabs.com/docs/captcha/api/akamai-sbsd)

```ts
const solved = await client.syncSolveAkamaiSBSDTaskProxyless({
  pageUrl: "https://example.com",
  sbsdUrl: "https://example.com/sbsd/xxxxx?v=xxx",
  bmSo: "bm_so_cookie_value",
  ua: "Mozilla/5.0 ...",
  lang: "en-US",
  script_base64: base64EncodedScript,
});

console.log(solved.solution.payload);
```

### DataDome

<a id="task-datadometaskproxyless"></a>

#### DataDomeTaskProxyless

Both steps return the same solution model: step one carries the challenge address in `url`, step two the validation instructions.

```ts
// Step one: find out where the challenge lives.
const first = await client.syncSolveDataDomeTaskProxyless({
  html_b64: challengeHtmlBase64,
  step: "1",
  referer: "https://example.com",
});

// Step two: capture the slider image, then ask for the validation instructions.
const second = await client.syncSolveDataDomeTaskProxyless({
  html_b64: challengeHtmlBase64,
  step: "2",
  image: base64EncodedSliderImage,
  referer: first.solution.url,
});
```

<a id="task-datadometagstaskproxyless"></a>

#### DataDomeTagsTaskProxyless

```ts
const solved = await client.syncSolveDataDomeTagsTaskProxyless({
  ddk: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  jstype: "ch",
  cid: "", // session identifier; empty is valid on first contact
  bpc: 1,  // one-based packet counter, incremented on every send
  referer: "https://example.com",
  ua: "Mozilla/5.0 ...",
});
```

### Other

<a id="task-perimeterx"></a>

#### PerimeterX

[PerimeterX API reference](https://docs.ezxlabs.com/docs/captcha/api/perimeterx)

The clearance cookies come back as top-level fields, with the leading underscore their cookie names carry.

```ts
const solved = await client.solvePerimeterX({
  websiteKey: "PXxxxxxxxx", // PerimeterX application identifier
  invisible: false,
});

console.log(solved.solution._px3);
```

<a id="task-incapsulataskproxyless"></a>

#### IncapsulaTaskProxyless

[Incapsula API reference](https://docs.ezxlabs.com/docs/captcha/api/incapsula)

`data` is stringified JSON and has to be submitted exactly as it arrived — parsing it would change what the sensor endpoint receives, so the SDK leaves it alone.

```ts
const solved = await client.syncSolveIncapsulaTaskProxyless({
  script: reese84ScriptSource,
  scriptUrl: "https://example.com/xxxxx?d=example.com",
  pageUrl: "https://example.com",
  acceptLanguage: "en-US,en;q=0.9",
  ua: "Mozilla/5.0 ...",
  pow: process.env["EZCAPTCHA_INCAPSULA_POW"],
});

console.log(solved.solution.data);
```

<a id="task-tlstask"></a>

#### TlsTask

[TLS forwarding API reference](https://docs.ezxlabs.com/docs/captcha/api/tls-forward)

```ts
const solved = await client.syncSolveTlsTask({
  tls_type: "chrome146", // browser fingerprint the worker presents
  proxy: "http://user:pass@host:8080",
  method: "GET",
  url: "https://example.com/api",
});

console.log(solved.solution.code, solved.solution.body);
```

### Custom parameters

Parameters this release does not model go inline, next to the declared ones. The object you write is the `task` object that goes on the wire.

```ts
const solved = await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
  someNewParameter: "whatever the docs say",
  aNumber: 42,
});
```

`extra` does the same thing, for when keeping pass-through parameters visibly separate is worth the nesting:

```ts
await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
  extra: { someNewParameter: "whatever the docs say" },
});
```

Two things worth knowing:

- A `type` passed this way is **ignored**. The SDK writes it last, so a stray `type` cannot silently bill a different task.
- Accepting arbitrary keys means TypeScript stops flagging a misspelled *optional* parameter — it is sent as a custom one instead. Required parameters and the types of declared ones are still checked.

### Reading a solution

There is no `extra` bucket on the way back. The solution object keeps every field the worker sent, so a declared field reads with a dot and an unmodelled one with a bracket:

```ts
const { solution } = solved;

solution.gRecaptchaResponse;   // declared — typed
solution.user_agent;           // declared — typed, may be undefined
solution["contextId"];         // not declared — typed `unknown`, narrow before use

Object.entries(solution);      // everything the worker returned
solved.raw;                    // the untouched value, when the exact bytes matter
```

A worker that starts returning a new field never loses it, with or without an SDK upgrade.

### Custom task types

The generic form takes any type string with any parameters, so a type the service ships today is usable without waiting for an SDK release:

```ts
const solved = await client.solve({
  type: "SomeBrandNewTaskType",
  websiteURL: "https://example.com",
  whateverTheDocsSay: 42,
});

// The synchronous endpoint takes the same shape.
await client.syncSolve({ type: "SomeBrandNewSyncType", image });
```

For a modelled type, the generic and named forms are equivalent:

```ts
await client.solve({ type: "HCaptcha", websiteURL, websiteKey });
await client.solveHCaptcha({ websiteURL, websiteKey });
```

### Low-level workflow

`createTask` is the billed call. Everything after it is free, so persist the id before doing anything that might fail — the service holds a result for five minutes, and a replacement task is billed again.

```ts
const taskId = await client.createTask({
  type: "ReCaptchaV2TaskProxyless",
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
});

// One query, no waiting. `status` narrows the result.
const once = await client.getTaskResult(taskId);
if (once.status === "ready") {
  console.log(once.solution); // guaranteed present on this branch
}

// Or poll until it finishes, with settings for this call only.
const result = await client.waitForResult(taskId, {
  polling: { interval: 2_000, maxAttempts: 30 },
});
```

## ⚙️ Configuration

Every option has a default shared with the Rust, Go and Python SDKs. Anything left out keeps its default.

```ts
const client = new EzCapSolverClient({
  clientKey: process.env.EZCAPTCHA_API_KEY,
  asyncBaseUrl: "https://api.ez-captcha.com",
  syncBaseUrl: "https://sync.ez-captcha.com",
  timeout: 30_000,
  syncTimeout: 240_000,
  polling: { interval: 3_000, maxAttempts: 50 },
  appId: undefined,
  userAgent: "my-app/1.0",
  logger: undefined,
  fetch: undefined,
});
```

| Option | Default | Notes |
| --- | --- | --- |
| `clientKey` | `EZCAPTCHA_API_KEY` | The only value read implicitly |
| `asyncBaseUrl` | `https://api.ez-captcha.com` | Asynchronous tasks and balance |
| `syncBaseUrl` | `https://sync.ez-captcha.com` | Synchronous tasks — a separate deployment |
| `timeout` | `30_000` ms | One asynchronous or balance request |
| `syncTimeout` | `240_000` ms | One synchronous task request |
| `polling.interval` | `3_000` ms | Applied before every query, the first included |
| `polling.maxAttempts` | `50` | Wait ceiling of two and a half minutes |
| `appId` | unset | Developer application identifier |
| `userAgent` | `ezcapsolver-js/<version> node/<version>` | |
| `logger` | none | See [Logging](#-logging) |
| `fetch` | `globalThis.fetch` | See below |

The two timeout budgets are deliberately separate. A synchronous call blocks until a worker answers and the service allows its slowest types 180 seconds; sharing one value would either cut that short — aborting a call that was already billed — or make a network fault take minutes to surface.

Everything checkable is checked at construction, so a bad setting throws before anything is billed.

```ts
client.config; // the effective configuration, with no clientKey on it
```

### Sending through a proxy

This is the one place the JavaScript SDK differs from the other three: there is no `proxy` option, because a proxy needs a dispatcher and only Node's `undici` supplies one. Depending on it would rule out Deno, Bun and Cloudflare Workers, so the SDK takes a `fetch` instead.

```ts
import { ProxyAgent } from "undici";

const dispatcher = new ProxyAgent("http://user:pass@proxy.example:8080");
const client = new EzCapSolverClient({
  fetch: (url, init) => fetch(url, { ...init, dispatcher } as RequestInit),
});
```

Node's global `fetch` honours `init.dispatcher`, so only the agent is needed. The same seam takes a tuned connection pool, or a stub in tests.

This is unrelated to the `proxy` parameter on a task, which is what the worker uses to reach the protected site.

## ⚠️ Errors

Every failure is an `EzCaptchaError` carrying a `kind` that says which layer it belongs to. The layering is by what you can do about the failure, not by where it came from.

| Kind | Class | Meaning |
| --- | --- | --- |
| `config` | `EzCaptchaError` | Invalid client configuration. Retrying is pointless. |
| `transport` | `TransportError` | The request never produced a response: DNS, TCP, TLS, timeout. |
| `api` | `ApiError` | A structured error reported by the service. |
| `polling-exhausted` | `PollingExhaustedError` | The task never finished within the budget. |
| `unexpected-response` | `UnexpectedResponseError` | The response did not parse, or broke the contract. |
| `solution-decode` | `SolutionDecodeError` | A raw solution did not fit its model. |
| `wait-interrupted` | `WaitInterruptedError` | A task was created — and billed — but waiting for it failed. |

```ts
import {
  isApiError,
  isTransportError,
  isPollingExhaustedError,
  isDecodeError,
  taskIdOf,
} from "ezcapsolver-js";

try {
  await client.solveHCaptcha({ websiteURL, websiteKey });
} catch (error) {
  // Ask this first: whether a billed task is still recoverable matters more
  // than what broke, and it is one question whichever error carries the id.
  const taskId = taskIdOf(error);
  if (taskId !== undefined) {
    const result = await client.waitForResult(taskId); // free; a new task is not
  }

  if (isApiError(error)) {
    if (error.isAuthenticationError()) {
      // Stop. The service counts these per key, and thirty within a minute
      // earn a three-minute ban. Do not back off and retry.
    } else if (error.isTerminal()) {
      // The same request will fail the same way. Change it.
    } else if (error.isRateLimited()) {
      // Throttled. Both codes clear on their own, so ask again later.
    }
    console.log(error.errorCode, error.httpStatus, error.errors);
  }
}
```

**Use the `isX` guards rather than `instanceof`.** A package published in both ESM and CJS can be loaded twice in one process, producing two unrelated class objects; `instanceof` then fails for an error that genuinely came from this SDK. The guards check a `Symbol.for` brand, which is shared process-wide.

**This SDK does not retry a request for you.** Creating a task is billed and is not idempotent, and the service temporarily bans a key that repeats certain credential errors, so the retry policy belongs to you. `isTerminal()`, `isAuthenticationError()` and `isRateLimited()` provide the facts needed to decide.

**A throttled poll is the one exception.** `ERROR_REQUEST_LIMIT` and `ERROR_REQUEST_BANNED` refuse the *query*, not the task: the service turns the request away before it ever looks the task up, so the task is still queued and still billed. `waitForResult` spends the attempt and polls again rather than discarding a result that was about to arrive. Every other `ApiError` is the poll's answer and ends the wait. Note that `isRateLimited()` is narrower than `!isTerminal()`, which is also true of every unknown code — including the worker codes that report a task that genuinely failed.

`errorId` is the sole success criterion. Most business errors arrive as HTTP 500 and a failed task arrives as HTTP 200, so the status line is not what the SDK branches on — and `ApiError.httpStatus` is always readable from one place.

## 📝 Logging

Logging is discarded unless a logger is supplied. The interface is pino-shaped, so a pino instance drops straight in:

```ts
import pino from "pino";

const client = new EzCapSolverClient({ logger: pino({ level: "trace" }) });
```

For something smaller, `consoleLogger` needs no dependency:

```ts
import { consoleLogger, EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient({ logger: consoleLogger("debug") });
```

Any object with the right method shape works; every level is optional.

```ts
const client = new EzCapSolverClient({
  logger: {
    debug: (fields, message) => myLogger.debug({ ...fields }, message),
    error: (fields, message) => myLogger.error({ ...fields }, message),
  },
});
```

| Level | What it carries |
| --- | --- |
| `trace` | Full request and response bodies, with `clientKey` and `proxy` replaced at any nesting depth |
| `debug` | Each polling attempt |
| `info` | Task created, task completed |

Bodies sit at `trace` on purpose: a DataDome `html_b64` or an Akamai `script_base64` runs to megabytes, and mixing them into `debug` would make that level unusable for watching the task lifecycle. Nothing is rendered below `trace`, so leaving it off costs nothing.

## 🧵 Concurrency

One client handles any number of concurrent calls. It holds no per-request state, and `fetch` pools connections underneath — a client per task only throws that pooling away.

```ts
// allSettled, not all: one failure must not discard tasks that were billed.
const results = await Promise.allSettled(
  sites.map((site) => client.solveReCaptchaV2TaskProxyless(site)),
);

for (const result of results) {
  if (result.status === "rejected") {
    const taskId = taskIdOf(result.reason); // still recoverable
  }
}
```

Every call takes an `AbortSignal`, merged with that call's own timeout, so one signal cancels a whole fan-out:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 60_000);

await client.solveHCaptcha({ websiteURL, websiteKey }, { signal: controller.signal });
```

The service applies its own rate limits per key, so cap the fan-out when the list is large — [`examples/concurrency.ts`](examples/concurrency.ts) shows one way.

## 🧪 Runnable Examples

[`examples/`](examples/) holds one file per task type, plus five about the SDK itself.

```bash
export EZCAPTCHA_API_KEY=your-client-key

# These two use the vendors' own demo pages and run as they are.
node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-task-proxyless.ts
node --experimental-strip-types examples/hcaptcha/hcaptcha.ts

# About the SDK itself rather than a task type
node --experimental-strip-types examples/client-setup.ts
node --experimental-strip-types examples/custom-parameters.ts
node --experimental-strip-types examples/logging-and-errors.ts
node --experimental-strip-types examples/concurrency.ts
node --experimental-strip-types examples/raw-usage.ts
```

The flag strips type annotations before running; Node 23.6 and later do that by default. The rest of the examples need page data captured from the target site — see [`examples/README.md`](examples/README.md) for the full index.

## 🛠️ Development

```bash
pnpm install

pnpm test              # 165 tests, none of which touch the real API
pnpm test:watch
pnpm test:coverage

pnpm lint              # biome, fixing what it can
pnpm build             # ESM + CJS + both sets of declarations
pnpm typecheck         # src, tests and examples in one pass
pnpm verify:package    # publint + are-the-types-wrong
```

`pnpm typecheck` needs `pnpm build` first: the examples import the package by name, which resolves through `exports` to `dist/`, so they are checked against the artifact that actually ships.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[Apache-2.0](LICENSE)
