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
    <a href="https://ezxlabs.com"><img alt="EZXLabs 官网" src="https://img.shields.io/badge/website-ezxlabs.com-FFDB29?logoColor=black"></a>
  </p>
  <p>
    <a href="https://ezxlabs.com">🌐 官网</a> &nbsp;·&nbsp;
    <a href="https://docs.ezxlabs.com/zh/docs/captcha/api">📚 EZCaptchaSolver API 文档</a> &nbsp;·&nbsp;
    <a href="https://github.com/EZXLabs/ezcapsolver-js/tree/main/examples">🧪 示例</a> &nbsp;·&nbsp;
    <a href="#-支持的验证码类型">🧩 验证码类型</a>
  </p>
  <p><a href="https://github.com/EZXLabs/ezcapsolver-js/blob/main/README.md">English</a> &nbsp;·&nbsp; <b>简体中文</b></p>
</div>

---

EZCaptchaSolver JavaScript SDK 是 [EZXLabs](https://ezxlabs.com) 维护的开源 JavaScript / TypeScript 客户端，用于接入其 CAPTCHA 识别任务 API。它为下列受支持的任务类型提供类型化请求和基于 Promise 的客户端；该包还包含不用于解验证码的 TLS 转发任务。了解 SDK 产品系列请查看 [EZCaptchaSolver SDK 产品页](https://ezxlabs.com/zh/products/sdk)，查看 HTTP 请求与响应字段请访问 [EZCaptchaSolver API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api)，JavaScript 调用代码请以[本仓库示例](https://github.com/EZXLabs/ezcapsolver-js/blob/main/examples/README.zh-CN.md)为准。

**零运行时依赖。** 基于平台原生 `fetch`,Node、Deno、Bun 和各类边缘运行时都能跑。

## 🧩 支持的验证码类型

验证码任务分同步和异步两种形态:

- **同步**:创建任务后请求阻塞,任务完成才返回。
- **异步**:创建任务返回一个任务 ID,之后按这个 ID 轮询取结果。适合耗时较长的类型。

一个类型可以同时支持两种形态,几乎所有类型都支持同步形态,少数只支持异步。

每个类型都有两个方法:`solveX` 创建任务并轮询结果,`syncSolveX` 走同步端点。两个都返回 Promise —— `sync` 指的是**服务端端点**,不是调用方式。

### reCAPTCHA v2

| 任务类型 | 形态 | 示例 | 说明 |
| :-: | :-: | :-: | --- |
| `ReCaptchaV2TaskProxyless` | 全部 | [示例](#task-recaptchav2taskproxyless) | reCAPTCHA v2 |
| `ReCaptchaV2TaskProxylessS9` | 全部 | [示例](#task-recaptchav2taskproxylesss9) | reCAPTCHA v2,返回分数 ≥ 0.9 的 token |
| `ReCaptchaV2STaskProxyless` | 全部 | [示例](#task-recaptchav2staskproxyless) | reCAPTCHA v2,带挑战绑定的 `s` 参数 |
| `ReCaptchaV2EnterpriseTaskProxyless` | 全部 | [示例](#task-recaptchav2enterprisetaskproxyless) | reCAPTCHA v2 企业版 |
| `ReCaptchaV2SEnterpriseTaskProxyless` | 全部 | [示例](#task-recaptchav2senterprisetaskproxyless) | reCAPTCHA v2 企业版,带 `s` 参数 |
| `ReCaptchaV2Classification` | 同步 | [示例](#task-recaptchav2classification) | reCAPTCHA v2 图片宫格识别 |

### reCAPTCHA v3

| 任务类型 | 形态 | 示例 | 说明 |
| :-: | :-: | :-: | --- |
| `ReCaptchaV3TaskProxyless` | 全部 | [示例](#task-recaptchav3taskproxyless) | reCAPTCHA v3 |
| `ReCaptchaV3TaskProxylessS9` | 全部 | [示例](#task-recaptchav3taskproxylesss9) | reCAPTCHA v3,返回分数 ≥ 0.9 的 token |
| `ReCaptchaV3EnterpriseTaskProxyless` | 全部 | [示例](#task-recaptchav3enterprisetaskproxyless) | reCAPTCHA v3 企业版 |
| `ReCaptchaV3EnterpriseTaskProxylessS9` | 全部 | [示例](#task-recaptchav3enterprisetaskproxylesss9) | reCAPTCHA v3 企业版,分数 ≥ 0.9 |

### FunCaptcha / Arkose Labs

| 任务类型 | 形态 | 示例 | 说明 |
| :-: | :-: | :-: | --- |
| `FuncaptchaTaskProxyless` | 全部 | [示例](#task-funcaptchataskproxyless) | FunCaptcha token |
| `FunCaptchaClassification` | 同步 | [示例](#task-funcaptchaclassification) | FunCaptcha 图片识别 |

### hCaptcha

| 任务类型 | 形态 | 示例 | 说明 |
| :-: | :-: | :-: | --- |
| `HCaptcha` | 全部 | [示例](#task-hcaptcha) | hCaptcha pass |
| `HCaptchaClassification` | 同步 | [示例](#task-hcaptchaclassification) | hCaptcha 图片识别 |

### Cloudflare

| 任务类型 | 形态 | 示例 | 说明 |
| :-: | :-: | :-: | --- |
| `CloudFlareTurnstileTask` | 全部 | [示例](#task-cloudflareturnstiletask) | Turnstile token |
| `CloudFlare5STask` | 全部 | [示例](#task-cloudflare5stask) | 五秒盾,返回的是浏览器状态而不是一个 token |

### Akamai

| 任务类型 | 形态 | 示例 | 说明 |
| :-: | :-: | :-: | --- |
| `AkamaiWEBTaskProxyless` | 同步 | [示例](#task-akamaiwebtaskproxyless) | Akamai Web 传感器载荷,逐轮进行 |
| `AkamaiSBSDTaskProxyless` | 同步 | [示例](#task-akamaisbsdtaskproxyless) | Akamai SBSD 传感器载荷 |

### DataDome

| 任务类型 | 形态 | 示例 | 说明 |
| :-: | :-: | :-: | --- |
| `DataDomeTaskProxyless` | 同步 | [示例](#task-datadometaskproxyless) | DataDome 挑战,含两个步骤 |
| `DataDomeTagsTaskProxyless` | 同步 | [示例](#task-datadometagstaskproxyless) | DataDome tags 载荷 |

### 其它

| 任务类型 | 形态 | 示例 | 说明 |
| :-: | :-: | :-: | --- |
| `PerimeterX` | 全部 | [示例](#task-perimeterx) | PerimeterX(按住滑块)通行 cookie |
| `IncapsulaTaskProxyless` | 同步 | [示例](#task-incapsulataskproxyless) | Incapsula Reese84 传感器载荷 |
| `TlsTask` | 同步 | [示例](#task-tlstask) | 用 worker 的 TLS 指纹转发一个 HTTP 请求 |

## 📦 安装

```bash
npm install ezcapsolver-js
pnpm add ezcapsolver-js
yarn add ezcapsolver-js
bun add ezcapsolver-js
```

**需要 Node 22.12 及以上。** 包同时提供 ESM 和 CommonJS 两份产物,各自带独立的类型声明,所以 `import` 和 `require` 都能用:

```ts
import { EzCapSolverClient } from "ezcapsolver-js";      // ESM
const { EzCapSolverClient } = require("ezcapsolver-js"); // CommonJS
```

类型声明已内置,不需要另装 `@types/` 包。

## 🚀 快速开始

```ts
import { EzCapSolverClient } from "ezcapsolver-js";

// 不传 key 时从环境变量 EZCAPTCHA_API_KEY 读取。
const client = new EzCapSolverClient({ clientKey: "your-client-key" });

const solved = await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://www.google.com/recaptcha/api2/demo",
  websiteKey: "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
});

console.log(solved.solution.gRecaptchaResponse);
console.log(await client.getBalance());
```

## 📖 用法

### 两个端点,一对方法

```ts
// 创建任务,然后轮询直到 worker 做完。
const solved = await client.solveHCaptcha({ websiteURL, websiteKey });

// 同步端点,在创建任务的那次请求上就把结果给你。
const solved = await client.syncSolveHCaptcha({ websiteURL, websiteKey });
```

两个都是 JavaScript 异步调用。区别在于走哪个服务端端点:`solve` 创建任务后轮询 `/getTaskResult`,`syncSolve` 直接打 `/createSyncTask` 并在那次请求上拿到结果。

没有特别理由时,按上面表格标注的形态选。服务端可能拒绝一个类型走它不提供的端点,这种拒绝只损失一次往返,不会浪费一个任务。

### 代理格式

有两种格式,用错会被拒:

| 格式 | 形状 | 适用 |
| --- | --- | --- |
| `NORMAL` | `protocol://username:password@host:port` | 除 FunCaptcha 外的所有类型 |
| `FUN` | `protocol://host:port:username:password` | 仅 `FuncaptchaTaskProxyless` |

`protocol` 取 `http`、`https` 或 `socks5`。**用户名和密码都必填**——服务端拒绝无认证的代理——且 host 不能是 `127.0.*`、`192.168.*`、`172.16.*`、`10.0.*` 这类内网地址。

这是 **worker 用来访问目标站点**的代理。SDK 自身流量走代理的配置见[配置](#-配置)。

### reCAPTCHA v2

[reCAPTCHA v2 API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/recaptcha-v2)

前五个类型共用同一套参数模型和同一个 solution 模型,只有方法名不同。

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

参数与普通 v2 完全相同;走高分队列,返回分数 ≥ 0.9 的 token。

```ts
const solved = await client.solveReCaptchaV2TaskProxylessS9({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
});
```

<a id="task-recaptchav2staskproxyless"></a>

#### ReCaptchaV2STaskProxyless

带挑战绑定的 `s` 参数。这个参数并非必填,不带时行为与普通 v2 一致。

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

走同步端点。`size` 是宫格宽度:单图传 `1`,宫格传 `3` 或 `4`。

```ts
import { isMultiClassification, isSingleClassification } from "ezcapsolver-js";

const solved = await client.syncSolveReCaptchaV2Classification({
  image: base64EncodedImage,
  question: "/m/014xcs", // Google 物体标识符,这个是「人行横道」
  size: 3,
});

const { solution } = solved;
if (isMultiClassification(solution)) {
  console.log(solution.objects); // 要点击的格子下标,从 0 开始
} else if (isSingleClassification(solution)) {
  console.log(solution.hasObject);
}
```

### reCAPTCHA v3

[reCAPTCHA v3 API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/recaptcha-v3)

`pageAction` 必须与目标页面评分时使用的 action 一致。

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

任务目录里这个类型写作 `RecaptchaV3EnterpriseTaskProxylessS9`。SDK 把它归一成与 ReCaptcha 家族其余类型一致的写法;服务端匹配任务类型时忽略大小写,两者到达同一个 worker。

```ts
const solved = await client.solveReCaptchaV3EnterpriseTaskProxylessS9({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_enterprise_key",
  pageAction: "examples/v3scores",
});
```

### FunCaptcha / Arkose Labs

[FunCaptcha API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/funcaptcha)

<a id="task-funcaptchataskproxyless"></a>

#### FuncaptchaTaskProxyless

这个类型的代理走 `FUN` 格式,另外注意线上类型名里的小写 `c`。

```ts
const solved = await client.solveFuncaptchaTaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "your_public_key",
  data: '{"blob":"..."}', // 页面产出 blob 时传
  proxy: "http://host:8080:user:pass",
});

console.log(solved.solution.token);
```

<a id="task-funcaptchaclassification"></a>

#### FunCaptchaClassification

这个类型的结果形态尚未确认。worker 返回的每个字段都在 solution 对象上,用方括号读。

```ts
const solved = await client.syncSolveFunCaptchaClassification({
  image: base64EncodedImage,
  question: "Pick the image that is the correct way up",
});

console.log(solved.raw);
```

### hCaptcha

[hCaptcha API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/hcaptcha)

<a id="task-hcaptcha"></a>

#### HCaptcha

```ts
const solved = await client.solveHCaptcha({
  websiteURL: "https://accounts.hcaptcha.com/demo",
  websiteKey: "a5f74b19-9e45-40e0-b45d-47ff91b7a6c2",
  lang: "en-US",
  invisible: false, // 站点不显示勾选框时传 true
  rqdata: process.env["EZCAPTCHA_HCAPTCHA_RQDATA"], // 全小写,与 Cloudflare 的 rqData 不同
});

console.log(solved.solution.generated_pass_UUID);
console.log(solved.solution.ua); // 携带该 pass 的请求必须用这个 User-Agent
```

<a id="task-hcaptchaclassification"></a>

#### HCaptchaClassification

这个类型的结果形态同样尚未确认。

```ts
const solved = await client.syncSolveHCaptchaClassification({
  image: base64EncodedImage,
  question: "Please click each image containing a crosswalk",
});
```

### Cloudflare

<a id="task-cloudflareturnstiletask"></a>

#### CloudFlareTurnstileTask

[Cloudflare Turnstile API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/turnstile)

```ts
const solved = await client.solveCloudFlareTurnstileTask({
  websiteURL: "https://example.com",
  websiteKey: "0x4AAAAAAA...", // Turnstile 站点密钥以 0x 开头
});

console.log(solved.solution.token);
```

<a id="task-cloudflare5stask"></a>

#### CloudFlare5STask

[Cloudflare 5S API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/cloudflare-5s)

这个类型没有单一 token。把返回的 header 和 cookie 回放到目标站点才是真正过盾的那一步,所以返回的是整个浏览器状态。`proxy` 对这个类型是**必填**,而且回放必须走同一个代理,否则通行凭证会被拒绝。

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

[Akamai Web API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/akamai-web)

多轮流程:把每轮返回的 `encodedata` 作为下一轮的 `encodeData` 传入,并递增 `index`。流程结束的那一轮不再返回新状态。

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

[Akamai SBSD API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/akamai-sbsd)

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

两个步骤返回同一个 solution 模型:步骤一在 `url` 里给出挑战地址,步骤二给出校验指令。

```ts
// 步骤一:拿到挑战地址。
const first = await client.syncSolveDataDomeTaskProxyless({
  html_b64: challengeHtmlBase64,
  step: "1",
  referer: "https://example.com",
});

// 步骤二:抓到滑块图片后,请求校验指令。
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
  cid: "", // 会话标识,首次接触传空串是合法的
  bpc: 1,  // 从 1 开始的包计数,每次发送递增
  referer: "https://example.com",
  ua: "Mozilla/5.0 ...",
});
```

### 其它

<a id="task-perimeterx"></a>

#### PerimeterX

[PerimeterX API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/perimeterx)

通行 cookie 是作为顶层字段返回的,并保留了 cookie 名自带的前导下划线。

```ts
const solved = await client.solvePerimeterX({
  websiteKey: "PXxxxxxxxx", // PerimeterX 应用标识,以 PX 开头
  invisible: false,
});

console.log(solved.solution._px3);
```

<a id="task-incapsulataskproxyless"></a>

#### IncapsulaTaskProxyless

[Incapsula API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/incapsula)

`data` 是字符串化的 JSON,必须原样提交——解析它会改变传感器端点收到的内容,所以 SDK 不碰它。

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

[TLS 转发 API 文档](https://docs.ezxlabs.com/zh/docs/captcha/api/tls-forward)

```ts
const solved = await client.syncSolveTlsTask({
  tls_type: "chrome146", // worker 要呈现的浏览器指纹
  proxy: "http://user:pass@host:8080",
  method: "GET",
  url: "https://example.com/api",
});

console.log(solved.solution.code, solved.solution.body);
```

### 自定义参数

本版未建模的参数直接内联写在已声明参数旁边。你写的这个对象就是发到线上的 `task` 对象。

```ts
const solved = await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
  someNewParameter: "whatever the docs say",
  aNumber: 42,
});
```

`extra` 做的是同一件事,适合想把透传参数在视觉上分开的场景:

```ts
await client.solveReCaptchaV2TaskProxyless({
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
  extra: { someNewParameter: "whatever the docs say" },
});
```

两点需要知道:

- 这样传进来的 `type` **会被忽略**。SDK 把它写在最后,所以一个误传的 `type` 不会导致按另一个类型计费。
- 允许任意键的代价是:TypeScript 不再拦截**可选参数**的拼写错误——拼错的会被当成自定义参数发出去。必填参数和已声明字段的类型**仍然受检**。

### 读取 solution

返回方向上没有 `extra` 桶。solution 对象保留了 worker 返回的每一个字段,已声明的用点号读,未声明的用方括号:

```ts
const { solution } = solved;

solution.gRecaptchaResponse;   // 已声明 —— 有类型
solution.user_agent;           // 已声明 —— 有类型,可能是 undefined
solution["contextId"];         // 未声明 —— 类型是 unknown,用前先收窄

Object.entries(solution);      // worker 返回的全部内容
solved.raw;                    // 未经改动的原始值,需要精确字节时用
```

worker 哪天开始返回新字段,不升级 SDK 也不会丢。

### 自定义任务类型

泛型形式接受任意类型字符串和任意参数,所以服务端今天上线的类型今天就能用,不必等 SDK 发版:

```ts
const solved = await client.solve({
  type: "SomeBrandNewTaskType",
  websiteURL: "https://example.com",
  whateverTheDocsSay: 42,
});

// 同步端点用法相同。
await client.syncSolve({ type: "SomeBrandNewSyncType", image });
```

对已建模的类型,泛型形式和具名方法完全等价:

```ts
await client.solve({ type: "HCaptcha", websiteURL, websiteKey });
await client.solveHCaptcha({ websiteURL, websiteKey });
```

### 底层流程

`createTask` 是**会扣费**的那一步,之后的调用都是免费的。所以在做任何可能失败的事之前先把 id 存下来——服务端保留结果 5 分钟,而重建一个任务会再扣一次费。

```ts
const taskId = await client.createTask({
  type: "ReCaptchaV2TaskProxyless",
  websiteURL: "https://example.com",
  websiteKey: "6Lc_your_site_key",
});

// 查一次,不等待。status 会收窄返回类型。
const once = await client.getTaskResult(taskId);
if (once.status === "ready") {
  console.log(once.solution); // 这个分支里保证存在
}

// 或者轮询到结束,只对这次调用生效的参数。
const result = await client.waitForResult(taskId, {
  polling: { interval: 2_000, maxAttempts: 30 },
});
```

## ⚙️ 配置

每个配置项的默认值都与 Rust、Go、Python 三版一致。不传的保持默认。

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

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `clientKey` | `EZCAPTCHA_API_KEY` | 唯一一个会隐式读取的值 |
| `asyncBaseUrl` | `https://api.ez-captcha.com` | 异步任务与余额查询 |
| `syncBaseUrl` | `https://sync.ez-captcha.com` | 同步任务 —— 是另一套部署 |
| `timeout` | `30_000` ms | 一次异步或余额请求 |
| `syncTimeout` | `240_000` ms | 一次同步任务请求 |
| `polling.interval` | `3_000` ms | 每次查询前都等,包括第一次 |
| `polling.maxAttempts` | `50` | 等待上限两分半 |
| `appId` | 未设 | 开发者应用标识 |
| `userAgent` | `ezcapsolver-js/<版本> node/<版本>` | |
| `logger` | 无 | 见[日志](#-日志) |
| `fetch` | `globalThis.fetch` | 见下 |

两条超时预算是**刻意分开**的。同步调用会一直阻塞到 worker 出结果,服务端给最慢的类型 180 秒;合成一个值要么会掐断它——中止一次已经扣过费的调用——要么让网络故障拖上几分钟才暴露。

所有可校验的配置都在构造时校验,所以错误配置会在任何扣费之前抛出。

```ts
client.config; // 生效的配置,上面没有 clientKey
```

### 让 SDK 自身流量走代理

这是 JavaScript 版与其它三版唯一的差异:**没有 `proxy` 配置项**。代理需要一个 dispatcher,而只有 Node 的 `undici` 提供,依赖它就等于放弃 Deno、Bun 和 Cloudflare Workers。所以 SDK 接受一个 `fetch`:

```ts
import { ProxyAgent } from "undici";

const dispatcher = new ProxyAgent("http://user:pass@proxy.example:8080");
const client = new EzCapSolverClient({
  fetch: (url, init) => fetch(url, { ...init, dispatcher } as RequestInit),
});
```

Node 的全局 `fetch` 认 `init.dispatcher`,所以只需要那个 agent,不用换 `undici.fetch`。同一个注入点也可以用来定制连接池,或者在测试里塞一个桩。

这和 task 参数里的 `proxy` 无关,后者是 worker 用来访问目标站点的。

## ⚠️ 错误处理

所有失败都是 `EzCaptchaError`,带一个 `kind` 标明属于哪一层。分层的依据是**你能对它做什么**,不是它从哪来。

| kind | 类 | 含义 |
| --- | --- | --- |
| `config` | `EzCaptchaError` | 客户端配置无效。重试没有意义。 |
| `transport` | `TransportError` | 请求没拿到响应:DNS、TCP、TLS、超时。 |
| `api` | `ApiError` | 服务端返回的结构化错误。 |
| `polling-exhausted` | `PollingExhaustedError` | 任务在预算内没有完成。 |
| `unexpected-response` | `UnexpectedResponseError` | 响应解析不了,或者违反了契约。 |
| `solution-decode` | `SolutionDecodeError` | 原始 solution 不符合模型。 |
| `wait-interrupted` | `WaitInterruptedError` | 任务已创建**并已扣费**,但等结果时失败了。 |

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
  // 先问这个:一个已扣费的任务还能不能救回来,比「什么坏了」更要紧,
  // 而且无论 id 挂在哪种错误上,这都是同一个问题。
  const taskId = taskIdOf(error);
  if (taskId !== undefined) {
    const result = await client.waitForResult(taskId); // 免费;重建任务不是
  }

  if (isApiError(error)) {
    if (error.isAuthenticationError()) {
      // 停手。服务端按 key 计数,一分钟内 30 次会封三分钟。
      // 不要退避重试。
    } else if (error.isTerminal()) {
      // 同样的请求会同样地失败。改请求。
    } else if (error.isRateLimited()) {
      // 被限流了。这两个码都会自行解除,过一会儿再问。
    }
    console.log(error.errorCode, error.httpStatus, error.errors);
  }
}
```

**用 `isX` 判定,不要用 `instanceof`。** 同时发布 ESM 和 CJS 的包可能在一个进程里被加载两次,产生两份互不相干的类构造器,这时 `instanceof` 会对真正来自本 SDK 的错误返回 false。判定函数查的是 `Symbol.for` 品牌,进程级共享。

**本 SDK 不替你重发请求。** 创建任务会扣费且非幂等,而且服务端会临时封禁重复触发凭证错误的 key,所以重试策略归你。`isTerminal()`、`isAuthenticationError()` 和 `isRateLimited()` 提供做这个决定所需的事实。

**被限流的那次轮询是唯一的例外。** `ERROR_REQUEST_LIMIT` 与 `ERROR_REQUEST_BANNED` 拒的是**这次查询**,不是任务:服务端在查任务之前就把请求挡回来了,任务仍在排队、也仍然扣着费。所以 `waitForResult` 消耗掉这一次机会后接着问,而不是把一个马上就要拿到的结果丢掉。其余任何 `ApiError` 都是这次轮询的答案,会直接结束等待。注意 `isRateLimited()` 比 `!isTerminal()` 窄得多——后者对所有不认识的码也为真,其中就包括 worker 报告任务真的失败时用的那些码。

`errorId` 是判定成功与否的**唯一**依据。大多数业务错误带着 HTTP 500 下来,失败的任务却带着 HTTP 200,所以 SDK 不按状态行分支——而 `ApiError.httpStatus` 永远能从同一个地方读到。

## 📝 日志

不传 logger 时日志被丢弃。接口是 pino 的形状,所以 pino 实例可以直接传:

```ts
import pino from "pino";

const client = new EzCapSolverClient({ logger: pino({ level: "trace" }) });
```

不想引依赖的话,`consoleLogger` 开箱可用:

```ts
import { consoleLogger, EzCapSolverClient } from "ezcapsolver-js";

const client = new EzCapSolverClient({ logger: consoleLogger("debug") });
```

任何方法形状对得上的对象都行,每个级别都是可选的:

```ts
const client = new EzCapSolverClient({
  logger: {
    debug: (fields, message) => myLogger.debug({ ...fields }, message),
    error: (fields, message) => myLogger.error({ ...fields }, message),
  },
});
```

| 级别 | 内容 |
| --- | --- |
| `trace` | 完整请求与响应体,`clientKey` 和 `proxy` 在任意嵌套深度都被替换 |
| `debug` | 每一次轮询 |
| `info` | 任务已创建、任务已完成 |

请求体放在 `trace` 是刻意的:DataDome 的 `html_b64` 或 Akamai 的 `script_base64` 动辄几 MB,混进 `debug` 会让这个级别没法用来观察任务生命周期。低于 `trace` 时请求体根本不会被渲染,所以不开完全没有成本。

## 🧵 并发

一个客户端可以承载任意数量的并发调用。它不持有任何单次请求的状态,底层 `fetch` 会复用连接——每个任务建一个客户端只会把连接复用白白扔掉。

```ts
// 用 allSettled 而不是 all:一个失败不该把已经扣过费的那些结果一起丢掉。
const results = await Promise.allSettled(
  sites.map((site) => client.solveReCaptchaV2TaskProxyless(site)),
);

for (const result of results) {
  if (result.status === "rejected") {
    const taskId = taskIdOf(result.reason); // 仍然可以救回来
  }
}
```

每个调用都接受 `AbortSignal`,并与该次调用自己的超时合并,所以一个信号可以取消整批:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 60_000);

await client.solveHCaptcha({ websiteURL, websiteKey }, { signal: controller.signal });
```

服务端按 key 有自己的限流,列表很大时要限制并发数——[`examples/concurrency.ts`](examples/concurrency.ts) 给了一种写法。

## 🧪 可运行示例

[`examples/`](examples/) 下每个任务类型一个文件,另有五个讲 SDK 本身。

```bash
export EZCAPTCHA_API_KEY=your-client-key

# 这两个用的是厂商自己的 demo 页面,可以原样跑通。
node --experimental-strip-types examples/recaptcha-v2/recaptcha-v2-task-proxyless.ts
node --experimental-strip-types examples/hcaptcha/hcaptcha.ts

# 讲 SDK 本身而不是某个任务类型的
node --experimental-strip-types examples/client-setup.ts
node --experimental-strip-types examples/custom-parameters.ts
node --experimental-strip-types examples/logging-and-errors.ts
node --experimental-strip-types examples/concurrency.ts
node --experimental-strip-types examples/raw-usage.ts
```

这个 flag 的作用是运行前剥掉类型标注,Node 23.6 及以后默认就会做。其余示例需要你从目标站点抓取的页面数据——完整索引见 [`examples/README.zh-CN.md`](examples/README.zh-CN.md)。

## 🛠️ 开发

```bash
pnpm install

pnpm test              # 165 个用例,没有一个会碰真实 API
pnpm test:watch
pnpm test:coverage

pnpm lint              # biome,能自动修的都修掉
pnpm build             # ESM + CJS + 两套类型声明
pnpm typecheck         # 一次覆盖 src、tests、examples
pnpm verify:package    # publint + are-the-types-wrong
```

`pnpm typecheck` 之前必须先 `pnpm build`:示例是按包名 import 的,会通过 `exports` 解析到 `dist/`,所以它们校验的是**真正发布出去的产物**。

欢迎贡献,详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 许可证

[Apache-2.0](LICENSE)
