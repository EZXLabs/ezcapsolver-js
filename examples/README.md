# Examples

One file per task type, one directory per vendor. Filenames come from the wire
task type, so they line up with the
[Python](https://github.com/EZXLabs/ezcapsolver-py/tree/main/examples),
[Go](https://github.com/EZXLabs/ezcapsolver-go/tree/main/examples) and
[Rust](https://github.com/EZXLabs/ezcapsolver-rs/tree/main/examples) SDKs
file for file, with hyphens where those use underscores. The handful that are
about the SDK itself rather than a task type sit at the top level; `fixtures/`
holds the sample images the classification examples read.

English · [简体中文](README.zh-CN.md)

## Running them

```bash
export EZCAPTCHA_API_KEY=your-client-key
export EZCAPTCHA_PROXY=http://user:pass@host:port   # only where noted

node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-task-proxyless.ts
```

The flag strips the type annotations before running. Node 23.6 and later do
that by default, so it can be dropped there.

Every example builds its client with no key argument, so it is read from
`EZCAPTCHA_API_KEY`.

Two run exactly as written — `recaptcha-v2-task-proxyless.ts` and `hcaptcha.ts`
point at the vendors' own demo pages. The rest carry placeholder site keys and
page data that you replace with values scraped from the site you are working
against.

Each example calls the named method for its type. The same task can always be
written in the generic form instead, which is what
[`raw-usage.ts`](raw-usage.ts) uses:

```ts
await client.solveReCaptchaV2TaskProxyless({ websiteURL, websiteKey });
await client.solve({ type: "ReCaptchaV2TaskProxyless", websiteURL, websiteKey });
```

## reCAPTCHA v2

| Example | Task type | |
| --- | --- | --- |
| [`recaptcha-v2-task-proxyless.ts`](recaptcha-v2/recaptcha-v2-task-proxyless.ts) | `ReCaptchaV2TaskProxyless` | runs as written |
| [`recaptcha-v2-task-proxyless-s9.ts`](recaptcha-v2/recaptcha-v2-task-proxyless-s9.ts) | `ReCaptchaV2TaskProxylessS9` | score ≥ 0.9 |
| [`recaptcha-v2-s-task-proxyless.ts`](recaptcha-v2/recaptcha-v2-s-task-proxyless.ts) | `ReCaptchaV2STaskProxyless` | carries the `s` parameter |
| [`recaptcha-v2-enterprise-task-proxyless.ts`](recaptcha-v2/recaptcha-v2-enterprise-task-proxyless.ts) | `ReCaptchaV2EnterpriseTaskProxyless` | |
| [`recaptcha-v2-s-enterprise-task-proxyless.ts`](recaptcha-v2/recaptcha-v2-s-enterprise-task-proxyless.ts) | `ReCaptchaV2SEnterpriseTaskProxyless` | |
| [`recaptcha-v2-classification.ts`](recaptcha-v2/recaptcha-v2-classification.ts) | `ReCaptchaV2Classification` | image grid |

## reCAPTCHA v3

| Example | Task type | |
| --- | --- | --- |
| [`recaptcha-v3-task-proxyless.ts`](recaptcha-v3/recaptcha-v3-task-proxyless.ts) | `ReCaptchaV3TaskProxyless` | |
| [`recaptcha-v3-task-proxyless-s9.ts`](recaptcha-v3/recaptcha-v3-task-proxyless-s9.ts) | `ReCaptchaV3TaskProxylessS9` | score ≥ 0.9 |
| [`recaptcha-v3-enterprise-task-proxyless.ts`](recaptcha-v3/recaptcha-v3-enterprise-task-proxyless.ts) | `ReCaptchaV3EnterpriseTaskProxyless` | |
| [`recaptcha-v3-enterprise-task-proxyless-s9.ts`](recaptcha-v3/recaptcha-v3-enterprise-task-proxyless-s9.ts) | `ReCaptchaV3EnterpriseTaskProxylessS9` | normalised from the catalog spelling |

## FunCaptcha / Arkose Labs

| Example | Task type | |
| --- | --- | --- |
| [`funcaptcha-task-proxyless.ts`](funcaptcha/funcaptcha-task-proxyless.ts) | `FuncaptchaTaskProxyless` | `FUN` proxy format |
| [`funcaptcha-classification.ts`](funcaptcha/funcaptcha-classification.ts) | `FunCaptchaClassification` | unconfirmed solution shape |

## hCaptcha

| Example | Task type | |
| --- | --- | --- |
| [`hcaptcha.ts`](hcaptcha/hcaptcha.ts) | `HCaptcha` | runs as written |
| [`hcaptcha-classification.ts`](hcaptcha/hcaptcha-classification.ts) | `HCaptchaClassification` | unconfirmed solution shape |

## Cloudflare

| Example | Task type | |
| --- | --- | --- |
| [`cloud-flare-turnstile-task.ts`](cloudflare/cloud-flare-turnstile-task.ts) | `CloudFlareTurnstileTask` | |
| [`cloud-flare-5s-task.ts`](cloudflare/cloud-flare-5s-task.ts) | `CloudFlare5STask` | proxy required; replays the state |

## PerimeterX

| Example | Task type | |
| --- | --- | --- |
| [`perimeter-x.ts`](perimeterx/perimeter-x.ts) | `PerimeterX` | |

## Akamai

| Example | Task type | |
| --- | --- | --- |
| [`akamai-web-task-proxyless.ts`](akamai/akamai-web-task-proxyless.ts) | `AkamaiWEBTaskProxyless` | multi-round flow |
| [`akamai-sbsd-task-proxyless.ts`](akamai/akamai-sbsd-task-proxyless.ts) | `AkamaiSBSDTaskProxyless` | |

## DataDome

| Example | Task type | |
| --- | --- | --- |
| [`datadome-task-proxyless.ts`](datadome/datadome-task-proxyless.ts) | `DataDomeTaskProxyless` | both challenge steps |
| [`datadome-tags-task-proxyless.ts`](datadome/datadome-tags-task-proxyless.ts) | `DataDomeTagsTaskProxyless` | |

## Incapsula

| Example | Task type | |
| --- | --- | --- |
| [`incapsula-task-proxyless.ts`](incapsula/incapsula-task-proxyless.ts) | `IncapsulaTaskProxyless` | Reese84 sensor |

## TLS forwarding

| Example | Task type | |
| --- | --- | --- |
| [`tls-task.ts`](tls-forward/tls-task.ts) | `TlsTask` | proxy required |

## The SDK itself

| Example | |
| --- | --- |
| [`client-setup.ts`](client-setup.ts) | every option, and routing through a proxy |
| [`custom-parameters.ts`](custom-parameters.ts) | sending parameters the SDK does not model, and reading fields it does not declare |
| [`logging-and-errors.ts`](logging-and-errors.ts) | trace logging, and telling the failure layers apart |
| [`concurrency.ts`](concurrency.ts) | many tasks at once, bounded fan-out, one signal to cancel |
| [`raw-usage.ts`](raw-usage.ts) | the workflow by hand, and task types the SDK does not model |
