import { describe, expect, it } from "vitest";

import { SolutionDecodeError } from "../src/errors.js";
import { decodeSolution, isMultiClassification, isSingleClassification } from "../src/solutions.js";
import { isKnownTaskType, KNOWN_TASK_TYPES, taskMode } from "../src/task-type.js";
import { taskParams } from "../src/tasks.js";

describe("task types", () => {
  it("models twenty-three of them, with no duplicates", () => {
    expect(KNOWN_TASK_TYPES).toHaveLength(23);
    expect(new Set(KNOWN_TASK_TYPES).size).toBe(23);
  });

  it("spells the service's irregularities exactly", () => {
    // These are the service's own irregular spellings. The SDK is part of the
    // published documentation and has to send them as the catalog does.
    expect(KNOWN_TASK_TYPES).toContain("FuncaptchaTaskProxyless"); // lowercase c
    expect(KNOWN_TASK_TYPES).toContain("FunCaptchaClassification"); // same family, capital C
    expect(KNOWN_TASK_TYPES).toContain("AkamaiWEBTaskProxyless"); // WEB is shouted
    expect(KNOWN_TASK_TYPES).toContain("TlsTask"); // not TLSTask
  });

  it("normalises the one spelling the SDKs deliberately do not copy", () => {
    // The catalog writes this as RecaptchaV3EnterpriseTaskProxylessS9, with a
    // lowercase c unlike every other ReCaptcha type. All four SDKs send the
    // capitalised form so that one spelling runs through the whole family; the
    // service matches task types case-insensitively, so it reaches the same
    // worker. This pins the decision against a well-meaning "fix" back.
    expect(KNOWN_TASK_TYPES).toContain("ReCaptchaV3EnterpriseTaskProxylessS9");
    expect(KNOWN_TASK_TYPES as readonly string[]).not.toContain(
      "RecaptchaV3EnterpriseTaskProxylessS9",
    );
    // Every ReCaptcha type now starts the same way.
    const family = KNOWN_TASK_TYPES.filter((t) => /^Re?[Cc]aptchaV[23]/i.test(t));
    expect(family.every((t) => t.startsWith("ReCaptcha"))).toBe(true);
    expect(family).toHaveLength(10);
  });

  it("tells a modelled type from one the service may add later", () => {
    expect(isKnownTaskType("HCaptcha")).toBe(true);
    expect(isKnownTaskType("SomethingTheServiceShipsTomorrow")).toBe(false);
  });

  it("reports which endpoint the service documents for a type", () => {
    expect(taskMode("ReCaptchaV2TaskProxyless")).toBe("async");
    expect(taskMode("ReCaptchaV2Classification")).toBe("sync");
    expect(taskMode("TlsTask")).toBe("sync");
    // An unmodelled type yields no answer rather than a guessed one.
    expect(taskMode("BrandNewType")).toBe(undefined);
  });

  it("counts nine synchronous types", () => {
    const sync = KNOWN_TASK_TYPES.filter((type) => taskMode(type) === "sync");
    expect(sync).toHaveLength(9);
  });
});

describe("turning a task into request parameters", () => {
  it("drops the type, which travels separately", () => {
    const params = taskParams({ type: "HCaptcha", websiteURL: "u", websiteKey: "k" });
    expect("type" in params).toBe(false);
    expect(params).toEqual({ websiteURL: "u", websiteKey: "k" });
  });

  it("flattens extra into the same level as declared parameters", () => {
    const params = taskParams({
      type: "HCaptcha",
      websiteURL: "u",
      websiteKey: "k",
      extra: { futureFlag: "x" },
    });
    expect(params).toEqual({ websiteURL: "u", websiteKey: "k", futureFlag: "x" });
    expect("extra" in params).toBe(false);
  });

  it("lets a declared parameter win over a duplicate in extra", () => {
    // An accidental duplicate in pass-through data must not silently replace an
    // explicit parameter.
    const params = taskParams({
      type: "HCaptcha",
      websiteURL: "declared",
      websiteKey: "k",
      extra: { websiteURL: "from-extra" },
    });
    expect(params["websiteURL"]).toBe("declared");
  });

  it("treats an explicitly undefined optional as absent", () => {
    // This is what lets a caller write proxy: process.env.X without a null check.
    const params = taskParams({
      type: "HCaptcha",
      websiteURL: "u",
      websiteKey: "k",
      proxy: undefined,
      lang: undefined,
    });
    expect(params).toEqual({ websiteURL: "u", websiteKey: "k" });
  });

  it("supplies the values the service validates against a closed set", () => {
    // The service validates these against a closed set, so omitting one is
    // rejected rather than defaulted.
    expect(taskParams({ type: "DataDomeTaskProxyless", html_b64: "h" })).toMatchObject({
      step: "1",
      image: "",
    });
    expect(
      taskParams({ type: "DataDomeTagsTaskProxyless", ddk: "d", referer: "r", ua: "u" }),
    ).toMatchObject({ jstype: "ch", cid: "", bpc: 1, fields: {} });
    expect(taskParams({ type: "TlsTask", tls_type: "c", proxy: "p", url: "u" })).toMatchObject({
      method: "GET",
      // Sent even when false: the other SDKs always send it, and an absent
      // flag would leave the worker guessing how `body` is encoded.
      body_raw: false,
    });
    expect(
      taskParams({ type: "AkamaiWEBTaskProxyless", pageUrl: "p", v3Url: "v", ua: "u", lang: "l" }),
    ).toMatchObject({ index: 0, abck: "", bmsz: "", script_base64: "", encodeData: "" });
  });

  it("spells hCaptcha's rqdata in lower case, unlike Cloudflare's rqData", () => {
    // One letter apart, and getting it wrong raises no error — the parameter is
    // just ignored. hCaptcha takes a string here, Cloudflare an object, so the
    // two are not interchangeable either.
    const hcaptcha = taskParams({
      type: "HCaptcha",
      websiteURL: "u",
      websiteKey: "k",
      lang: "en-US",
      invisible: false,
      rqdata: "rq",
    });
    expect(hcaptcha["rqdata"]).toBe("rq");
    expect("rqData" in hcaptcha).toBe(false);
    // false is a statement rather than an omission, so it has to survive.
    expect(hcaptcha["invisible"]).toBe(false);

    const cloudflare = taskParams({
      type: "CloudFlare5STask",
      websiteURL: "u",
      proxy: "p",
      rqData: { cType: "managed" },
    });
    expect(cloudflare["rqData"]).toEqual({ cType: "managed" });
    expect("rqdata" in cloudflare).toBe(false);
  });

  it("lets the caller override a supplied default", () => {
    const params = taskParams({
      type: "TlsTask",
      tls_type: "c",
      proxy: "p",
      url: "u",
      method: "POST",
    });
    expect(params["method"]).toBe("POST");
  });

  it("leaves alone the fields the service defaults for itself", () => {
    // The service defaults size and V3's isInvisible itself; leaving them out is
    // what lets it apply its own value.
    const classification = taskParams({
      type: "ReCaptchaV2Classification",
      image: "i",
      question: "q",
    });
    expect("size" in classification).toBe(false);

    const v3 = taskParams({ type: "ReCaptchaV3TaskProxyless", websiteURL: "u", websiteKey: "k" });
    expect("isInvisible" in v3).toBe(false);
  });
});

describe("decoding a solution", () => {
  it("hands back the worker's object untouched", () => {
    const raw = { gRecaptchaResponse: "tok", user_agent: "ua", brandNew: [1, 2] };
    const decoded = decodeSolution("ReCaptchaV2TaskProxyless", raw, JSON.stringify(raw));
    // Nothing is copied or renamed: the decoded object is the lossless form.
    expect(decoded).toBe(raw);
  });

  it("rejects a confirmed field that is missing", () => {
    const raw = { user_agent: "ua" };
    const error = catchOf(() =>
      decodeSolution("ReCaptchaV2TaskProxyless", raw, JSON.stringify(raw)),
    );
    expect(error).toBeInstanceOf(SolutionDecodeError);
    expect(String(error)).toContain('missing required field "gRecaptchaResponse"');
  });

  it("rejects a confirmed field that is the wrong type", () => {
    const raw = { gRecaptchaResponse: 42 };
    const error = catchOf(() =>
      decodeSolution("ReCaptchaV2TaskProxyless", raw, JSON.stringify(raw)),
    );
    expect(String(error)).toContain("expected a string");
  });

  it("accepts an empty string, which is the worker's answer rather than a fault", () => {
    // Being stricter than Go and Python would break alignment the other way:
    // both of those check for the key's presence and nothing more.
    const raw = { gRecaptchaResponse: "" };
    expect(() => decodeSolution("ReCaptchaV2TaskProxyless", raw, "{}")).not.toThrow();
  });

  it("rejects a solution that is not an object at all", () => {
    for (const raw of [null, "a string", 42, [1, 2]]) {
      const error = catchOf(() => decodeSolution("HCaptcha", raw, JSON.stringify(raw)));
      expect(error).toBeInstanceOf(SolutionDecodeError);
      expect(String(error)).toContain("expected a JSON object");
    }
  });

  it("checks nothing for a type whose shape is unconfirmed", () => {
    // Guessing at fields is worse than declaring none — a wrong model reads
    // like a contract.
    expect(() => decodeSolution("FunCaptchaClassification", {}, "{}")).not.toThrow();
    expect(() => decodeSolution("HCaptchaClassification", { anything: 1 }, "{}")).not.toThrow();
  });

  it("checks nothing for a type this release does not model", () => {
    expect(() => decodeSolution("BrandNewType", { whatever: true }, "{}")).not.toThrow();
  });
});

describe("classification results", () => {
  it("tells the two worker result kinds apart", () => {
    expect(isMultiClassification({ type: "multi", objects: [1, 4] })).toBe(true);
    expect(isSingleClassification({ type: "multi", objects: [1, 4] })).toBe(false);
    expect(isSingleClassification({ type: "single", hasObject: true })).toBe(true);
    // An unrecognised type is neither, and is left for the caller to interpret.
    expect(isMultiClassification({ type: "something-else" })).toBe(false);
    expect(isSingleClassification({ type: "something-else" })).toBe(false);
  });
});

/** Runs `fn` and returns whatever it threw. */
function catchOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}
