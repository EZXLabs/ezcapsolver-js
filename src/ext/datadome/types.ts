/**
 * What a DataDome workflow takes and returns.
 *
 * @module
 */

/** `Accept-Language` sent when a challenge names none. */
export const DEFAULT_ACCEPT_LANGUAGE = "en-US,en;q=0.9";

/**
 * A page behind DataDome, and the browser identity to clear its challenge
 * with.
 *
 * Every browser-side request of one run goes out through `proxy` with
 * `userAgent`. Keep using both for the requests that carry the cookie the run
 * returns.
 */
export interface DataDomeChallenge {
  /**
   * Page on the protected site. It is fetched first, and the run only goes on
   * when DataDome intercepts it.
   */
  targetUrl: string;
  /**
   * Browser `User-Agent` sent with every browser-side request.
   *
   * Its `Chrome/<major>` version also selects the TLS fingerprint, so it must
   * name a Chrome release with a fingerprint preset: 131, or 144 to 158.
   */
  userAgent: string;
  /**
   * Proxy for every browser-side request, such as `http://user:pass@host:port`.
   * Unset means a direct connection.
   *
   * Calls to the EzCaptchaSolver API do not use it; they go through the
   * client's own `fetch`.
   */
  proxy?: string | undefined;
  /** `Accept-Language` sent with every browser-side request. Defaults to `en-US,en;q=0.9`. */
  acceptLanguage?: string | undefined;
}

/** The cookie DataDome issues once its challenge is cleared. */
export interface DataDomeCookie {
  /** Cookie name, normally `datadome`. */
  name: string;
  /** Cookie value. */
  value: string;
  /**
   * Domain the cookie applies to: its `Domain` attribute, or the last two
   * labels of the target host, such as `.example.com`, when DataDome omits it.
   */
  domain: string;
  /** The cookie exactly as DataDome returned it, attributes included. */
  raw: string;
}
