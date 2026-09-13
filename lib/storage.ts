import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const memoryStore = new Map<string, string>();
const AUTH_SESSION_KEY = "auth_session";

function getPersistentStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

export async function setItem(key: string, value: string, persist = false) {
  if (!persist) {
    memoryStore.set(key, value);
    return;
  }

  if (Platform.OS === "web") {
    const storage = getPersistentStorage();
    if (storage) {
      storage.setItem(key, value);
      return;
    }
  } else {
    try {
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
    } catch {
      // Fall back to in-memory storage when secure storage is unavailable.
    }
  }

  memoryStore.set(key, value);
}

export async function getItem(key: string) {
  if (memoryStore.has(key)) {
    return memoryStore.get(key) ?? null;
  }

  if (Platform.OS === "web") {
    const storage = getPersistentStorage();

    if (storage) {
      return storage.getItem(key) ?? null;
    }

    return null;
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      return await SecureStore.getItemAsync(key);
    }
  } catch {
    return null;
  }

  return null;
}

export async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    const storage = getPersistentStorage();

    if (storage) {
      storage.removeItem(key);
    }
  } else {
    try {
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch {
      // Ignore delete failures and still clear in-memory value.
    }
  }

  memoryStore.delete(key);
}

export async function setAuthSession(
  user: {
    email: string;
    name?: string | null;
    phoneNumber?: string | null;
    address?: string | null;
    username?: string | null;
    role?: string | null;
    avatarUri?: string | null;
    avatarPath?: string | null;
    avatarLibraryKey?: string | null;
  },
  keepSignedIn = false,
) {
  await setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      authenticated: true,
      email: user.email,
      name: user.name ?? null,
      phoneNumber: user.phoneNumber ?? null,
      address: user.address ?? null,
      username: user.username ?? null,
      role: user.role ?? null,
      avatarUri: user.avatarUri ?? null,
      avatarPath: user.avatarPath ?? null,
      avatarLibraryKey: user.avatarLibraryKey ?? null,
      rememberMe: keepSignedIn,
    }),
    keepSignedIn,
  );
}

type AuthSessionUpdates = Partial<{
  name: string | null;
  phoneNumber: string | null;
  address: string | null;
  username: string | null;
  role: string | null;
  avatarUri: string | null;
  avatarPath: string | null;
  avatarLibraryKey: string | null;
}>;

export async function updateAuthSession(updates: AuthSessionUpdates) {
  const session = await getAuthSession();

  if (!session?.authenticated || !session?.email) {
    return;
  }

  // An explicitly passed null means "clear this", which is how switching from
  // an uploaded avatar to a library one drops the old signed URL. Only an
  // absent key falls back to the stored value.
  const resolve = (key: keyof AuthSessionUpdates) =>
    (Object.prototype.hasOwnProperty.call(updates, key)
      ? updates[key]
      : session[key]) ?? null;

  await setAuthSession(
    {
      email: session.email,
      name: resolve("name"),
      phoneNumber: resolve("phoneNumber"),
      address: resolve("address"),
      username: resolve("username"),
      role: resolve("role"),
      avatarUri: resolve("avatarUri"),
      avatarPath: resolve("avatarPath"),
      avatarLibraryKey: resolve("avatarLibraryKey"),
    },
    Boolean(session.rememberMe),
  );
}

export async function getAuthSession() {
  const stored = await getItem(AUTH_SESSION_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export async function clearAuthSession() {
  await deleteItem(AUTH_SESSION_KEY);
}

const REMEMBERED_CREDENTIALS_KEY = "remembered_credentials";

/**
 * Persists the raw email/password for the "Remember me" checkbox so the
 * login form can be pre-filled next time. Stored via SecureStore (Keychain /
 * Keystore) on native and localStorage on web, matching every other
 * persistent value in this file — never as plaintext app-local state.
 */
export async function setRememberedCredentials(credentials: {
  email: string;
  password: string;
}) {
  await setItem(
    REMEMBERED_CREDENTIALS_KEY,
    JSON.stringify({ email: credentials.email, password: credentials.password }),
    true,
  );
}

export async function getRememberedCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  const stored = await getItem(REMEMBERED_CREDENTIALS_KEY);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    if (typeof parsed?.email === "string" && typeof parsed?.password === "string") {
      return { email: parsed.email, password: parsed.password };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearRememberedCredentials() {
  await deleteItem(REMEMBERED_CREDENTIALS_KEY);
}
