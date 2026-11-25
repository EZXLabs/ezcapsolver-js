import { describe, expect, it } from "vitest";

import {
  externalScriptUrl,
  inlineScript,
  isChallenged,
  isHardBlocked,
  isSlider,
  scriptHash,
  stripBanner,
} from "../src/ext/datadome/page.js";

// The vectors are the ones the Rust, Python and Go SDKs pin, so every SDK hashes
// the same script to the same cache key.
const BANNER_LINE =
  "/* DataDome is a cyberfraud solution to detect bot activity @license https://datadome.co v1.33.1 d5110df */";
const INTERSTITIAL_BODY = ";(function(){var A={};})();";

describe("the challenge script hash", () => {
  it("only strips a first line that opens and closes a comment", () => {
    expect(stripBanner(`${BANNER_LINE}\n${INTERSTITIAL_BODY}`)).toBe(INTERSTITIAL_BODY);
    expect(stripBanner(INTERSTITIAL_BODY)).toBe(INTERSTITIAL_BODY);
    expect(stripBanner(`var x=1;\n${INTERSTITIAL_BODY}`)).toBe(`var x=1;\n${INTERSTITIAL_BODY}`);
    expect(stripBanner("/* unclosed\nvar x=1;")).toBe("/* unclosed\nvar x=1;");
    expect(stripBanner(BANNER_LINE)).toBe("");
  });

  it("is the MD5 of the script without its banner", () => {
    // RFC 1321 test vector.
    expect(scriptHash("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(scriptHash(`${BANNER_LINE}\n${INTERSTITIAL_BODY}`)).toBe(scriptHash(INTERSTITIAL_BODY));
  });
});

describe("finding the challenge script", () => {
  it("ends an interstitial bundle before the session glue", () => {
    const html =
      "<html><head>" +
      '<script src="https://ct.captcha-delivery.com/interstitial.1.33.0.x.js"></script>' +
      "<script>var small=1;</script>" +
      `<script>var ddm={cid:'session-unique'};\n${BANNER_LINE}\n${INTERSTITIAL_BODY}\n` +
      "var glue='initialCid=session-unique';</script>" +
      "</head></html>";
    expect(inlineScript(html)).toBe(`${BANNER_LINE}\n${INTERSTITIAL_BODY}`.replace(/;$/, ""));
    expect(externalScriptUrl(html)).toBe(
      "https://ct.captcha-delivery.com/interstitial.1.33.0.x.js",
    );
  });

  it("keeps the static glue of a slider bundle", () => {
    const html =
      "<script>var ddm={};\n/** DataDome v1.34.0 96eb15b */\n!function A(){}();\nvar g=1;</script>";
    expect(inlineScript(html)).toBe(
      "/** DataDome v1.34.0 96eb15b */\n!function A(){}();\nvar g=1;",
    );
  });

  it("starts a bundle without a banner where its code does", () => {
    expect(inlineScript("<script>var a=1;</script>")).toBe("var a=1;");
    expect(inlineScript("<script>var a=1;\n!function B(){}();</script>")).toBe(
      "!function B(){}();",
    );
    expect(inlineScript('<script src="x.js"></script>')).toBeUndefined();
    expect(inlineScript("<p>no scripts</p>")).toBeUndefined();
  });

  it("finds a hash-named external script past the loaders", () => {
    const html =
      '<script src="https://ct.captcha-delivery.com/i.js"></script>' +
      '<script src="//ct.captcha-delivery.com/5d512141a346e3bf.js"></script>';
    expect(externalScriptUrl(html)).toBe("https://ct.captcha-delivery.com/5d512141a346e3bf.js");
    expect(
      externalScriptUrl('<script src="https://ct.captcha-delivery.com/c.js"></script>'),
    ).toBeUndefined();
  });
});

describe("classifying a page", () => {
  it("reads the markers DataDome leaves", () => {
    expect(isHardBlocked("<p>hardblock</p>")).toBe(true);
    expect(isChallenged("<script>var dd={'cid':'x'}</script>")).toBe(true);
    expect(isChallenged("<html>welcome</html>")).toBe(false);
    expect(isSlider(new URL("https://geo.captcha-delivery.com/captcha/?initialCid=x"))).toBe(true);
    expect(isSlider(new URL("https://geo.captcha-delivery.com/interstitial/?initialCid=x"))).toBe(
      false,
    );
  });
});
