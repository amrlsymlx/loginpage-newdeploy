import { normalizeAvatarLibraryKey } from "./avatarLibrary";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
  updateAuthSession,
} from "./storage";
import { SUPABASE_CONFIGURED, supabase } from "./supabase";

export type Profile = {
  email: string;
  name: string;
  phoneNumber: string;
  address: string;
  username: string;
  role: string;
  avatarUri: string | null;
  avatarPath: string | null;
  avatarLibraryKey: string | null;
};

const AVATAR_SIGNED_URL_TTL_SECONDS = 3600;

const readString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

/**
 * A user has either a picked library avatar or an uploaded one, never both.
 * A library key always wins over a stale uploaded path.
 */
const resolveAvatar = async (metadata: Record<string, any>) => {
  const libraryKey = normalizeAvatarLibraryKey(metadata.avatarLibraryKey);
  if (libraryKey) {
    return { avatarUri: null, avatarPath: null, avatarLibraryKey: libraryKey };
  }

  const avatarPath = readString(metadata.avatarPath);
  if (avatarPath && SUPABASE_CONFIGURED && supabase) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);

    return {
      avatarUri: data?.signedUrl ?? null,
      avatarPath,
      avatarLibraryKey: null,
    };
  }

  return { avatarUri: null, avatarPath: null, avatarLibraryKey: null };
};

/** Builds a profile from a Supabase user, resolving a fresh avatar URL. */
export const buildProfileFromUser = async (user: {
  email?: string | null;
  user_metadata?: Record<string, any> | null;
}): Promise<Profile> => {
  const email = user.email ?? "";
  const metadata = user.user_metadata ?? {};

  return {
    email,
    name: readString(metadata.name) ?? readString(metadata.full_name) ?? "",
    phoneNumber:
      readString(metadata.phoneNumber) ??
      readString(metadata.phone_number) ??
      "N/A",
    address: readString(metadata.address) ?? "N/A",
    username: readString(metadata.username) ?? email.split("@")[0] ?? "N/A",
    role: readString(metadata.role) ?? "user",
    ...(await resolveAvatar(metadata)),
  };
};

/** Writes a freshly signed-in user's profile to local session storage. */
export const persistProfile = async (profile: Profile, keepSignedIn: boolean) =>
  setAuthSession(profile, keepSignedIn);

/**
 * Returns the signed-in user's profile, always re-validated against a live
 * Supabase session. Returns null (never a stale cached profile) when there is
 * no current session, so a returning user can never reach the dashboard
 * without actually being authenticated. Also re-signs the avatar URL, which
 * expires after an hour.
 */
export const loadProfile = async (): Promise<Profile | null> => {
  const session = await getAuthSession();
  if (!session?.authenticated || !session?.email) {
    return null;
  }

  if (!SUPABASE_CONFIGURED || !supabase) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    await clearAuthSession();
    return null;
  }

  const profile = await buildProfileFromUser(data.user);
  await updateAuthSession(profile);
  return profile;
};
