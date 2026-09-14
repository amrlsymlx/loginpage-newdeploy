import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { supabaseAuthStorage } from "./authStorage";

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "<YOUR_SUPABASE_URL>";
const rawKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "<YOUR_SUPABASE_ANON_KEY>";

export const SUPABASE_CONFIGURED =
  typeof rawUrl === "string" &&
  /^https?:\/\//i.test(rawUrl) &&
  rawKey &&
  !rawUrl.includes("<YOUR_") &&
  !rawKey.includes("<YOUR_");

let _supabase: SupabaseClient | null = null;
if (SUPABASE_CONFIGURED) {
  _supabase = createClient(rawUrl, rawKey, {
    auth: {
      // Refresh tokens live in SecureStore/localStorage, honouring the user's
      // "Keep me signed in" choice. See lib/authStorage.ts.
      storage: supabaseAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export const supabase: SupabaseClient | null = _supabase;

// On native, `autoRefreshToken` alone is not enough: the refresh timer is a JS
// interval, and the OS suspends it while the app is backgrounded. Without this
// the access token can quietly expire, and the next call that needs it fails as
// if the user had been signed out. The browser keeps its own timers running, so
// this is native-only. (Documented requirement in Supabase's React Native guide.)
if (_supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void _supabase.auth.startAutoRefresh();
    } else {
      void _supabase.auth.stopAutoRefresh();
    }
  });
}
