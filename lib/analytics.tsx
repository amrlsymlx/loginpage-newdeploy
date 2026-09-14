import type { AnalyticsEventProperties } from "./analytics.types";

export type { AnalyticsEventProperties } from "./analytics.types";

/**
 * Native no-op. Vercel Web Analytics is a browser-only product: the collector
 * script is served from `/_vercel/insights/script.js` by the Vercel edge and
 * the package injects it with `document.createElement`.
 *
 * The package's own `isBrowser()` guard is not enough to protect native — it
 * only checks for `window`, which React Native *does* define — so the web
 * implementation is kept behind a platform extension instead. See
 * `analytics.web.tsx`.
 */
export function Analytics(): React.ReactElement | null {
  return null;
}

/** Matches `TrackEvent`; drops the event because there is nowhere to send it. */
export function track(
  _name: string,
  _properties?: AnalyticsEventProperties,
): void {}
