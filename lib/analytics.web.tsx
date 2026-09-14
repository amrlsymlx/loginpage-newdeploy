import {
  Analytics as VercelAnalytics,
  track as vercelTrack,
} from "@vercel/analytics/react";
import type { AnalyticsEventProperties } from "./analytics.types";

export type { AnalyticsEventProperties } from "./analytics.types";

/**
 * Mounts the Vercel Web Analytics collector. Renders nothing — the component
 * only injects a `<script>` into `document.head` from an effect, so it is safe
 * inside the React Native view tree and during Expo's static web prerender.
 *
 * No `route`/`path` props: passing them switches the script into manual mode,
 * and the route would have to come from `computeRoute(pathname, params)`, which
 * rewrites any path segment whose text matches a param *value*. Expo Router
 * hands back query strings in the same bag as path params, so a link like
 * `/dashboard?next=dashboard` would be filed under `/[next]`. Every route here
 * is static, so the script's built-in `pushState` tracking is both simpler and
 * more accurate.
 *
 * In development the package loads `script.debug.js`, which logs events to the
 * console instead of sending them.
 */
export function Analytics(): React.ReactElement | null {
  return <VercelAnalytics />;
}

/**
 * Records a custom event, e.g. `track("sign_in", { method: "password" })`.
 * Custom events need Web Analytics enabled on the Vercel project; they are
 * dropped on native (see `analytics.tsx`).
 */
export function track(
  name: string,
  properties?: AnalyticsEventProperties,
): void {
  vercelTrack(name, properties);
}
