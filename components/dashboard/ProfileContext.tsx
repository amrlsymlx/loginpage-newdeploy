import { createContext, useContext } from "react";
import type { Profile } from "../../lib/profile";

type DashboardProfileContextValue = {
  profile: Profile | null;
  /** Re-reads the profile from Supabase, e.g. after an avatar change. */
  refresh: () => Promise<void>;
};

/**
 * The dashboard layout loads the profile once per focus and shares it here,
 * so individual tabs do not each repeat the same getUser + signed-URL work.
 */
export const DashboardProfileContext =
  createContext<DashboardProfileContextValue | null>(null);

export function useDashboardProfile() {
  const context = useContext(DashboardProfileContext);
  if (!context) {
    throw new Error(
      "useDashboardProfile must be used within DashboardProfileContext",
    );
  }
  return context;
}
