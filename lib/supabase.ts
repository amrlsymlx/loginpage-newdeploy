import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
