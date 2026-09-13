import { ImageSourcePropType } from "react-native";

export const AVATAR_LIBRARY_OPTIONS = [
  {
    key: "avatar:blue-1",
    label: "Blue",
    source: require("../assets/avatar/blue-1.png"),
  },
  {
    key: "avatar:brown-1",
    label: "Brown",
    source: require("../assets/avatar/brown-1.png"),
  },
  {
    key: "avatar:green-1",
    label: "Green",
    source: require("../assets/avatar/green-1.png"),
  },
  {
    key: "avatar:orange-1",
    label: "Orange",
    source: require("../assets/avatar/orange-1.png"),
  },
  {
    key: "avatar:pink-1",
    label: "Pink",
    source: require("../assets/avatar/pink-1.png"),
  },
  {
    key: "avatar:turquoise-1",
    label: "Turquoise",
    source: require("../assets/avatar/turquoise-1.png"),
  },
  {
    key: "avatar:violet-1",
    label: "Violet",
    source: require("../assets/avatar/violet-1.png"),
  },
  {
    key: "avatar:wacom-1",
    label: "Wacom",
    source: require("../assets/avatar/wacom-1.png"),
  },
] as const;

const DEFAULT_AVATAR = AVATAR_LIBRARY_OPTIONS[0];

type AvatarLibraryOption = (typeof AVATAR_LIBRARY_OPTIONS)[number];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const normalizeAvatarLibraryKey = (key: string | null | undefined) => {
  if (!key) {
    return null;
  }

  const exists = AVATAR_LIBRARY_OPTIONS.some((option) => option.key === key);
  return exists ? key : null;
};

export const getAvatarOptionByKey = (
  key: string | null | undefined,
): AvatarLibraryOption | null => {
  const normalizedKey = normalizeAvatarLibraryKey(key);
  if (!normalizedKey) {
    return null;
  }

  return (
    AVATAR_LIBRARY_OPTIONS.find((option) => option.key === normalizedKey) ||
    null
  );
};

export const getRandomAvatarLibraryKey = () => {
  const index = Math.floor(Math.random() * AVATAR_LIBRARY_OPTIONS.length);
  return AVATAR_LIBRARY_OPTIONS[index].key;
};

export const getAvatarSource = (
  key: string | null | undefined,
  seed?: string | null,
): ImageSourcePropType => {
  const fromKey = getAvatarOptionByKey(key);
  if (fromKey) {
    return fromKey.source;
  }

  if (seed && seed.trim().length > 0) {
    const index = hashString(seed) % AVATAR_LIBRARY_OPTIONS.length;
    return AVATAR_LIBRARY_OPTIONS[index].source;
  }

  return DEFAULT_AVATAR.source;
};
