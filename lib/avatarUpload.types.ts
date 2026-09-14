import type { ImagePickerAsset } from "expo-image-picker";

export type PreparedAvatar = {
  /** Upload body accepted by supabase-js: bytes on native, a Blob on web. */
  body: Uint8Array | Blob;
  contentType: string;
  /** File extension matching `contentType`, without the dot. */
  extension: string;
  /** Local URI that can render the picked image before the upload finishes. */
  previewUri: string;
};

export type PrepareAvatarUpload = (
  asset: ImagePickerAsset,
) => Promise<PreparedAvatar>;

const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

/**
 * Pickers report anything from `image/heic` to an empty string depending on the
 * platform and source, so fall back to JPEG rather than uploading a file whose
 * stored content type does not match its bytes.
 */
export function describeImageType(mimeType?: string | null) {
  const normalized = (mimeType ?? "").trim().toLowerCase();
  const extension = SUPPORTED_IMAGE_TYPES[normalized];

  if (!extension) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  return { contentType: normalized, extension };
}
