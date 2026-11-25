/**
 * Reading the pages of a DataDome challenge.
 *
 * The script hash is the key the service caches challenge scripts under, so
 * the extraction and hashing rules here have to match the service's exactly,
 * and those of the other language SDKs. The tests pin them to fixed vectors.
 *
 * @module
 */

import { createHash } from "node:crypto";

/** Text DataDome puts on the page of a visitor it has banned outright. */
const HARD_BLOCK_MARKER = "hardblock";
/** Text every page DataDome intercepted carries. */
const CHALLENGE_MARKER = "var dd";
/** Path segment of a slider captcha address; the interstitial uses another. */
const SLIDER_PATH = "/captcha/";
/** What closes the invisible interstitial bundle. */
const BUNDLE_CLOSE = "})()";
/** CDN scripts that bootstrap a challenge but are not its bundle. */
const LOADER_SCRIPTS: ReadonlySet<string> = new Set(["i.js", "c.js"]);

/** Every `<script>` element: its opening tag, then its body. */
const SCRIPT_ELEMENT = /(<script\b[^>]*>)(.*?)<\/script>/gis;
/** A `src` attribute, which marks an opening tag as an external script. */
const SRC_ATTRIBUTE = /\bsrc\s*=/;
/** The version banner, `/* DataDome ... *\/` or `/** DataDome ... *\/`. */
const BANNER = /\/\*+\s*DataDome[^*]*\*\//;
/** How the interstitial bundle opens, right after its banner. */
const INTERSTITIAL_OPENING = /^\s*;\s*\(function\s*\(\)\s*\{/;
/** Where a bundle without a banner starts: the slider or the interstitial form. */
const BUNDLE_START = /!\s*function\s+[A-Za-z_$][\w$]*\s*\(|;\s*\(function\s*\(\)\s*\{/;
/** An external challenge script with a descriptive name. */
const NAMED_EXTERNAL_SCRIPT =
  /<script\b[^>]*?\bsrc\s*=\s*["']((?:https:)?\/\/ct\.captcha-delivery\.com\/(?:interstitial|captcha)\.[^"']+?\.js)["']/i;
/**
 * An external challenge script named by its content hash, which DataDome
 * switched to in November 2026.
 */
const HASHED_EXTERNAL_SCRIPT =
  /<script\b[^>]*?\bsrc\s*=\s*["']((?:https:)?\/\/ct\.captcha-delivery\.com\/[A-Za-z0-9][A-Za-z0-9._-]*?\.js)["']/gi;

/** Whether DataDome banned the visitor outright; only a different IP helps. */
export function isHardBlocked(html: string): boolean {
  return html.includes(HARD_BLOCK_MARKER);
}

/** Whether DataDome intercepted the page with a challenge. */
export function isChallenged(html: string): boolean {
  return html.includes(CHALLENGE_MARKER);
}

/**
 * Whether a challenge address leads to the slider captcha rather than to the
 * invisible interstitial.
 */
export function isSlider(challengeUrl: URL): boolean {
  return challengeUrl.pathname.includes(SLIDER_PATH);
}

/** Base64-encodes page or script text the way the service expects it. */
export function encodeText(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

/**
 * Strips the version banner DataDome puts on the first line of its script.
 *
 * The banner changes with every release while the code under it may not, so
 * it stays out of the hash. Only a first line that opens and closes a comment
 * counts as a banner; anything else is returned unchanged.
 */
export function stripBanner(script: string): string {
  if (!script.startsWith("/*")) return script;
  const newline = script.indexOf("\n");
  const firstLine = newline < 0 ? script : script.slice(0, newline);
  if (!firstLine.includes("*/")) return script;
  return newline < 0 ? "" : script.slice(newline + 1);
}

/**
 * Content-addressed identifier of a challenge script: the lower-case hex MD5
 * of the script without its banner.
 */
export function scriptHash(script: string): string {
  return createHash("md5").update(stripBanner(script), "utf8").digest("hex");
}

/**
 * Address of the challenge script when the page loads it from DataDome's CDN,
 * or `undefined` when the page embeds it.
 *
 * A descriptively named script wins; otherwise the first hash-named one that
 * is not a loader. A protocol-relative address is completed with `https:`.
 */
export function externalScriptUrl(html: string): string | undefined {
  const named = NAMED_EXTERNAL_SCRIPT.exec(html)?.[1];
  if (named !== undefined) return absoluteSrc(named);
  for (const match of html.matchAll(HASHED_EXTERNAL_SCRIPT)) {
    const src = match[1];
    if (src !== undefined && !isLoader(src)) return absoluteSrc(src);
  }
  return undefined;
}

/** Whether a CDN script only bootstraps a challenge. */
function isLoader(src: string): boolean {
  const fileName = src.slice(src.lastIndexOf("/") + 1).toLowerCase();
  return LOADER_SCRIPTS.has(fileName);
}

/** Completes a protocol-relative script address with `https:`. */
function absoluteSrc(src: string): string {
  return src.startsWith("//") ? `https:${src}` : src;
}

/**
 * The challenge script embedded in the page, cut down to the part that is the
 * same for every session, or `undefined` when the page embeds none.
 *
 * The bundle is the longest inline script by far, and it is cut from its
 * version banner on. An interstitial bundle also ends at its closing `})()`:
 * what follows is page glue that carries session-unique identifiers, and
 * hashing those would never hit the cache. A slider bundle keeps everything to
 * the end of its script. Without a banner, the bundle runs from where its code
 * starts.
 */
export function inlineScript(html: string): string | undefined {
  const script = longestInlineScript(html);
  if (script === undefined) return undefined;
  const banner = BANNER.exec(script);
  if (banner === null) {
    return script.slice(BUNDLE_START.exec(script)?.index ?? 0);
  }
  const bundle = script.slice(banner.index);
  const afterBanner = bundle.slice(banner[0].length);
  if (INTERSTITIAL_OPENING.test(afterBanner)) {
    const end = bundle.lastIndexOf(BUNDLE_CLOSE);
    if (end >= 0) return bundle.slice(0, end + BUNDLE_CLOSE.length);
  }
  return bundle;
}

/**
 * The longest non-empty body among the scripts without a `src` attribute; the
 * first one wins a tie.
 */
function longestInlineScript(html: string): string | undefined {
  let longest = "";
  for (const [, openingTag = "", body = ""] of html.matchAll(SCRIPT_ELEMENT)) {
    if (SRC_ATTRIBUTE.test(openingTag)) continue;
    if (body.length > longest.length) longest = body;
  }
  return longest === "" ? undefined : longest;
}
