import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Storage adapter backing the Supabase auth client.
 *
 * Replaces the old "remember me" mechanism, which persisted the user's raw
 * password. Supabase's own refresh token is stored instead: in SecureStore on
 * native (chunked, because SecureStore caps a single value at 2048 bytes) and
 * in localStorage on web.
 *
 * When the user opts out of staying signed in, tokens live only in memory and
 * disappear with the app.
 */

// Comfortably under SecureStore's 2048-byte ceiling. Session values are
// base64url JWTs plus JSON, so one character is one byte in practice.
const CHUNK_SIZE = 1500;

const PERSISTENCE_FLAG_KEY = "auth_persistence_enabled";

const memoryStore = new Map<string, string>();

const getLocalStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    // Access throws in some privacy modes.
    return null;
  }
};

const metaKeyFor = (key: string) => `${key}.meta`;
const chunkKeyFor = (key: string, index: number) => `${key}.${index}`;

const readChunkCount = async (key: string) => {
  const raw = await SecureStore.getItemAsync(metaKeyFor(key));
  const count = Number(raw);
  return Number.isInteger(count) && count > 0 ? count : 0;
};

const secureGet = async (key: string) => {
  const count = await readChunkCount(key);
  if (count === 0) {
    return null;
  }

  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const part = await SecureStore.getItemAsync(chunkKeyFor(key, index));
    if (part == null) {
      // A partially written or partially evicted value is unusable.
      return null;
    }
    parts.push(part);
  }

  return parts.join("");
};

const secureSet = async (key: string, value: string) => {
  const previousCount = await readChunkCount(key);

  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE));
  }
  if (chunks.length === 0) {
    chunks.push("");
  }

  for (let index = 0; index < chunks.length; index += 1) {
    await SecureStore.setItemAsync(chunkKeyFor(key, index), chunks[index]);
  }
  await SecureStore.setItemAsync(metaKeyFor(key), String(chunks.length));

  // Drop chunks left over from a longer previous value.
  for (let index = chunks.length; index < previousCount; index += 1) {
    await SecureStore.deleteItemAsync(chunkKeyFor(key, index));
  }
};

const secureDelete = async (key: string) => {
  const previousCount = await readChunkCount(key);
  await SecureStore.deleteItemAsync(metaKeyFor(key));
  for (let index = 0; index < previousCount; index += 1) {
    await SecureStore.deleteItemAsync(chunkKeyFor(key, index));
  }
};

const persistentGet = async (key: string) => {
  if (Platform.OS === "web") {
    return getLocalStorage()?.getItem(key) ?? null;
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      return await secureGet(key);
    }
  } catch {
    // Fall through to the in-memory value below.
  }

  return null;
};

const persistentSet = async (key: string, value: string) => {
  if (Platform.OS === "web") {
    getLocalStorage()?.setItem(key, value);
    return;
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      await secureSet(key, value);
    }
  } catch {
    // Secure storage unavailable; the in-memory copy is the fallback.
  }
};

const persistentDelete = async (key: string) => {
  if (Platform.OS === "web") {
    getLocalStorage()?.removeItem(key);
    return;
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      await secureDelete(key);
    }
  } catch {
    // Nothing to clean up.
  }
};

let persistencePromise: Promise<boolean> | null = null;

/**
 * Whether auth tokens survive an app restart. Defaults to true so the
 * "Keep me signed in" checkbox can start checked.
 */
export const getAuthPersistence = () => {
  if (!persistencePromise) {
    persistencePromise = persistentGet(PERSISTENCE_FLAG_KEY).then(
      (stored) => stored !== "false",
    );
  }

  return persistencePromise;
};

export const setAuthPersistence = async (enabled: boolean) => {
  persistencePromise = Promise.resolve(enabled);
  await persistentSet(PERSISTENCE_FLAG_KEY, enabled ? "true" : "false");
};

export const supabaseAuthStorage = {
  async getItem(key: string) {
    if (memoryStore.has(key)) {
      return memoryStore.get(key) ?? null;
    }

    if (!(await getAuthPersistence())) {
      return null;
    }

    const stored = await persistentGet(key);
    if (stored != null) {
      memoryStore.set(key, stored);
    }

    return stored;
  },

  async setItem(key: string, value: string) {
    memoryStore.set(key, value);

    if (await getAuthPersistence()) {
      await persistentSet(key, value);
      return;
    }

    // Opted out: make sure an earlier persisted token cannot linger.
    await persistentDelete(key);
  },

  async removeItem(key: string) {
    memoryStore.delete(key);
    await persistentDelete(key);
  },
};
