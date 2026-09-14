import type { ImagePickerAsset } from "expo-image-picker";
import {
  describeImageType,
  type PreparedAvatar,
} from "./avatarUpload.types";

export type { PreparedAvatar } from "./avatarUpload.types";

/** Avatars never render larger than this, and phone cameras shoot far bigger. */
const AVATAR_SIZE = 512;
const JPEG_QUALITY = 0.85;

/**
 * Web implementation. Two things differ from native:
 *
 * 1. expo-file-system has no web support, so the bytes come from the `File`
 *    the browser attached to the asset (or from re-fetching the `blob:` URI).
 * 2. `allowsEditing`, `aspect` and `quality` are all ignored by the web picker,
 *    so a phone camera shot arrives as a multi-megabyte full-resolution image.
 *    We centre-crop it to a square and downscale it here instead.
 */
export const prepareAvatarUpload = async (
  asset: ImagePickerAsset,
): Promise<PreparedAvatar> => {
  const original = await resolveBlob(asset);
  const square = await cropToSquare(original);

  if (square) {
    return {
      body: square,
      contentType: "image/jpeg",
      extension: "jpg",
      previewUri: URL.createObjectURL(square),
    };
  }

  // Formats the browser cannot decode (some HEIC photos in non-Safari
  // browsers) still upload fine as-is — they just skip the resize.
  const { contentType, extension } = describeImageType(
    original.type || asset.mimeType,
  );

  return {
    body: original,
    contentType,
    extension,
    previewUri: asset.uri,
  };
};

const resolveBlob = async (asset: ImagePickerAsset): Promise<Blob> => {
  if (asset.file) {
    return asset.file;
  }

  const response = await fetch(asset.uri);
  return await response.blob();
};

/**
 * Returns null when the image cannot be decoded or encoded, so the caller can
 * fall back to uploading the original file untouched.
 */
const cropToSquare = async (blob: Blob): Promise<Blob | null> => {
  const source = await decode(blob);

  if (!source) {
    return null;
  }

  try {
    const edge = Math.min(source.width, source.height);
    const size = Math.min(edge, AVATAR_SIZE);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(
      source as CanvasImageSource,
      (source.width - edge) / 2,
      (source.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      size,
      size,
    );

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", JPEG_QUALITY);
    });
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
  }
};

type DecodedImage = (ImageBitmap | HTMLImageElement) & {
  width: number;
  height: number;
};

const decode = async (blob: Blob): Promise<DecodedImage | null> => {
  // createImageBitmap applies the EXIF orientation phone cameras rely on;
  // without it portrait shots upload sideways.
  if (typeof createImageBitmap === "function") {
    try {
      return (await createImageBitmap(blob, {
        imageOrientation: "from-image",
      })) as DecodedImage;
    } catch {
      // Fall through to the <img> decoder below.
    }
  }

  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise<DecodedImage | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image as DecodedImage);
      image.onerror = () => resolve(null);
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
