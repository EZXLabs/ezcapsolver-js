/**
 * The browser a challenge run presents itself as.
 *
 * DataDome compares what each request claims against how it is sent, so every
 * header set here mirrors what Chrome sends for that kind of request, and the
 * TLS fingerprint follows the Chrome version the user agent names.
 *
 * @module
 */

import { DataDomeError } from "../errors.js";

/** `Accept` of a document or frame navigation. */
const DOCUMENT_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
/** `Accept-Encoding` Chrome sends. */
const ACCEPT_ENCODING = "gzip, deflate, br, zstd";
/** Origin of the page a POST submission comes from. */
export const CHALLENGE_ORIGIN = "https://geo.captcha-delivery.com";
/** Content type of a POST submission. */
export const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded; charset=UTF-8";
/** Where the Chrome version starts in a user agent. */
const CHROME_VERSION = /Chrome\/(\d+)/;

/** Chrome versions lkrequest has a TLS fingerprint preset for: one older release, then a range. */
const LEGACY_CHROME_PRESET = 131;
const OLDEST_CHROME_PRESET = 144;
const NEWEST_CHROME_PRESET = 158;

/** Request headers, in the order Chrome sends them. */
export type Headers = Array<[name: string, value: string]>;

/** The browser identity every request of one run shares. */
export class BrowserProfile {
  readonly #userAgent: string;
  readonly #acceptLanguage: string;
  readonly #chromeMajor: number;

  /**
   * @throws DataDomeError when the user agent names no Chrome version.
   */
  constructor(userAgent: string, acceptLanguage: string) {
    const major = chromeMajor(userAgent);
    if (major === undefined) {
      throw new DataDomeError(`userAgent must name a Chrome version, got "${userAgent}"`);
    }
    this.#userAgent = userAgent;
    this.#acceptLanguage = acceptLanguage;
    this.#chromeMajor = major;
  }

  /**
   * The lkrequest preset with the TLS and HTTP/2 fingerprint of the Chrome
   * version the user agent names.
   *
   * @throws DataDomeError when lkrequest has no preset for that version.
   */
  tlsPreset(): string {
    const major = this.#chromeMajor;
    if (
      major !== LEGACY_CHROME_PRESET &&
      (major < OLDEST_CHROME_PRESET || major > NEWEST_CHROME_PRESET)
    ) {
      throw new DataDomeError(
        `no TLS fingerprint for Chrome ${major}; use ${LEGACY_CHROME_PRESET}, ` +
          `or ${OLDEST_CHROME_PRESET} to ${NEWEST_CHROME_PRESET}`,
      );
    }
    return `chrome_${major}`;
  }

  /** Headers of the first visit to the protected page. */
  navigation(): Headers {
    return [
      ...this.#device(),
      ["accept", DOCUMENT_ACCEPT],
      ["upgrade-insecure-requests", "1"],
      ["sec-fetch-site", "none"],
      ["sec-fetch-mode", "navigate"],
      ["sec-fetch-user", "?1"],
      ["sec-fetch-dest", "document"],
    ];
  }

  /**
   * Headers of loading the challenge into its frame.
   *
   * The slider frame gets the full page address as its referer; the
   * interstitial only its origin, as a real visitor's browser sends them.
   */
  challengeFrame(target: URL, slider: boolean): Headers {
    return [
      ...this.#device(),
      ["accept", DOCUMENT_ACCEPT],
      ["upgrade-insecure-requests", "1"],
      ["sec-fetch-site", "cross-site"],
      ["sec-fetch-mode", "navigate"],
      ["sec-fetch-dest", "iframe"],
      ["referer", slider ? target.href : target.origin],
    ];
  }

  /**
   * Headers of fetching the external challenge script.
   *
   * It has to look like a script load: the CDN rejects navigation headers.
   */
  script(challengeUrl: URL): Headers {
    return [
      ...this.#device(),
      ["accept", "*/*"],
      ["sec-fetch-site", "same-site"],
      ["sec-fetch-mode", "no-cors"],
      ["sec-fetch-dest", "script"],
      ["referer", `${challengeUrl.origin}/`],
    ];
  }

  /** Headers of submitting the answer from the challenge frame. */
  submission(challengeUrl: URL, post: boolean): Headers {
    const form: Headers = post
      ? [
          ["content-type", FORM_CONTENT_TYPE],
          ["origin", CHALLENGE_ORIGIN],
        ]
      : [];
    return [
      ...this.#device(),
      ...form,
      ["accept", "*/*"],
      ["sec-fetch-site", "same-origin"],
      ["sec-fetch-mode", "cors"],
      ["sec-fetch-dest", "empty"],
      ["referer", challengeUrl.href],
    ];
  }

  /** Headers every request carries: the client hints and the identity. */
  #device(): Headers {
    const version = this.#chromeMajor;
    return [
      [
        "sec-ch-ua",
        `"Chromium";v="${version}", "Google Chrome";v="${version}", "Not/A)Brand";v="99"`,
      ],
      ["sec-ch-ua-mobile", "?0"],
      ["sec-ch-ua-platform", `"${this.#platform()}"`],
      ["user-agent", this.#userAgent],
      ["accept-encoding", ACCEPT_ENCODING],
      ["accept-language", this.#acceptLanguage],
    ];
  }

  /** `Sec-CH-UA-Platform` value matching the operating system in the user agent. */
  #platform(): string {
    if (this.#userAgent.includes("Macintosh")) return "macOS";
    if (this.#userAgent.includes("Linux")) return "Linux";
    return "Windows";
  }
}

/** Chrome major version named in a user agent. */
export function chromeMajor(userAgent: string): number | undefined {
  const digits = CHROME_VERSION.exec(userAgent)?.[1];
  return digits === undefined ? undefined : Number(digits);
}
