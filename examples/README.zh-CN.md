# 示例

一个任务类型一个文件,一个厂商一个目录。文件名取自线上任务类型名,因此与
[Python](https://github.com/EZXLabs/ezcapsolver-py/tree/main/examples)、
[Go](https://github.com/EZXLabs/ezcapsolver-go/tree/main/examples)、
[Rust](https://github.com/EZXLabs/ezcapsolver-rs/tree/main/examples)
三版逐个对应,只是把下划线换成了连字符。讲 SDK 本身而非某个任务类型的几个放在顶层;
`fixtures/` 放分类示例读取的样例图片。

[English](README.md) · 简体中文

## 怎么跑

```bash
export EZCAPTCHA_API_KEY=your-client-key
export EZCAPTCHA_PROXY=http://user:pass@host:port   # 仅标注需要的示例用得到

node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-task-proxyless.ts
```

这个 flag 的作用是运行前剥掉类型标注。Node 23.6 及以后默认就会做,可以省掉。

每个示例都不传 key 构造客户端,所以 key 从 `EZCAPTCHA_API_KEY` 读。

有两个可以原样跑通 —— `recaptcha-v2-task-proxyless.ts` 和 `hcaptcha.ts` 指向的是
厂商自己的 demo 页面。其余的站点密钥和页面数据都是占位值,需要替换成你从目标站点上
抓到的真实值。

每个示例用的都是对应类型的具名方法。同一个任务永远可以改用泛型形式写,
[`raw-usage.ts`](raw-usage.ts) 用的就是后者:

```ts
await client.solveReCaptchaV2TaskProxyless({ websiteURL, websiteKey });
await client.solve({ type: "ReCaptchaV2TaskProxyless", websiteURL, websiteKey });
```

## reCAPTCHA v2

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`recaptcha-v2-task-proxyless.ts`](recaptcha-v2/recaptcha-v2-task-proxyless.ts) | `ReCaptchaV2TaskProxyless` | 可原样跑通 |
| [`recaptcha-v2-task-proxyless-s9.ts`](recaptcha-v2/recaptcha-v2-task-proxyless-s9.ts) | `ReCaptchaV2TaskProxylessS9` | 分数 ≥ 0.9 |
| [`recaptcha-v2-s-task-proxyless.ts`](recaptcha-v2/recaptcha-v2-s-task-proxyless.ts) | `ReCaptchaV2STaskProxyless` | 带 `s` 参数 |
| [`recaptcha-v2-enterprise-task-proxyless.ts`](recaptcha-v2/recaptcha-v2-enterprise-task-proxyless.ts) | `ReCaptchaV2EnterpriseTaskProxyless` | |
| [`recaptcha-v2-s-enterprise-task-proxyless.ts`](recaptcha-v2/recaptcha-v2-s-enterprise-task-proxyless.ts) | `ReCaptchaV2SEnterpriseTaskProxyless` | |
| [`recaptcha-v2-classification.ts`](recaptcha-v2/recaptcha-v2-classification.ts) | `ReCaptchaV2Classification` | 图片宫格识别 |

## reCAPTCHA v3

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`recaptcha-v3-task-proxyless.ts`](recaptcha-v3/recaptcha-v3-task-proxyless.ts) | `ReCaptchaV3TaskProxyless` | |
| [`recaptcha-v3-task-proxyless-s9.ts`](recaptcha-v3/recaptcha-v3-task-proxyless-s9.ts) | `ReCaptchaV3TaskProxylessS9` | 分数 ≥ 0.9 |
| [`recaptcha-v3-enterprise-task-proxyless.ts`](recaptcha-v3/recaptcha-v3-enterprise-task-proxyless.ts) | `ReCaptchaV3EnterpriseTaskProxyless` | |
| [`recaptcha-v3-enterprise-task-proxyless-s9.ts`](recaptcha-v3/recaptcha-v3-enterprise-task-proxyless-s9.ts) | `ReCaptchaV3EnterpriseTaskProxylessS9` | 已从目录里的拼写归一 |

## FunCaptcha / Arkose Labs

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`funcaptcha-task-proxyless.ts`](funcaptcha/funcaptcha-task-proxyless.ts) | `FuncaptchaTaskProxyless` | `FUN` 代理格式 |
| [`funcaptcha-classification.ts`](funcaptcha/funcaptcha-classification.ts) | `FunCaptchaClassification` | solution 形态未确认 |

## hCaptcha

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`hcaptcha.ts`](hcaptcha/hcaptcha.ts) | `HCaptcha` | 可原样跑通 |
| [`hcaptcha-classification.ts`](hcaptcha/hcaptcha-classification.ts) | `HCaptchaClassification` | solution 形态未确认 |

## Cloudflare

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`cloud-flare-turnstile-task.ts`](cloudflare/cloud-flare-turnstile-task.ts) | `CloudFlareTurnstileTask` | |
| [`cloud-flare-5s-task.ts`](cloudflare/cloud-flare-5s-task.ts) | `CloudFlare5STask` | 必须带代理;演示回放状态 |

## PerimeterX

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`perimeter-x.ts`](perimeterx/perimeter-x.ts) | `PerimeterX` | |

## Akamai

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`akamai-web-task-proxyless.ts`](akamai/akamai-web-task-proxyless.ts) | `AkamaiWEBTaskProxyless` | 多轮握手 |
| [`akamai-sbsd-task-proxyless.ts`](akamai/akamai-sbsd-task-proxyless.ts) | `AkamaiSBSDTaskProxyless` | |

## DataDome

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`datadome-task-proxyless.ts`](datadome/datadome-task-proxyless.ts) | `DataDomeTaskProxyless` | 两个挑战步骤 |
| [`datadome-tags-task-proxyless.ts`](datadome/datadome-tags-task-proxyless.ts) | `DataDomeTagsTaskProxyless` | |

## Incapsula

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`incapsula-task-proxyless.ts`](incapsula/incapsula-task-proxyless.ts) | `IncapsulaTaskProxyless` | Reese84 传感器 |

## TLS 转发

| 示例 | 任务类型 | |
| --- | --- | --- |
| [`tls-task.ts`](tls-forward/tls-task.ts) | `TlsTask` | 必须带代理 |

## SDK 本身

| 示例 | |
| --- | --- |
| [`client-setup.ts`](client-setup.ts) | 全部配置项,以及怎么走代理 |
| [`custom-parameters.ts`](custom-parameters.ts) | 发送 SDK 未建模的参数,读取未声明的返回字段 |
| [`logging-and-errors.ts`](logging-and-errors.ts) | trace 日志,以及区分各层失败 |
| [`concurrency.ts`](concurrency.ts) | 并发提交、限制并发数、一个信号取消全部 |
| [`raw-usage.ts`](raw-usage.ts) | 手动驱动流程,以及使用 SDK 未建模的类型 |
