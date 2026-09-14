/**
 * Vercel Web Analytics only accepts flat property bags — nested objects are
 * rejected (in dev they throw, in production they are silently stripped).
 */
export type AnalyticsEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export type TrackEvent = (
  name: string,
  properties?: AnalyticsEventProperties,
) => void;
