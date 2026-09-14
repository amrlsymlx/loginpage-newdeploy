import { decode as decodeBase64 } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import type { ImagePickerAsset } from "expo-image-picker";
import {
  describeImageType,
  type PreparedAvatar,
} from "./avatarUpload.types";

export type { PreparedAvatar } from "./avatarUpload.types";

/**
 * Native implementation. The picker hands back a `file://` URI, which only
 * expo-file-system can read — see `avatarUpload.web.ts` for the browser path,
 * where expo-file-system does not exist at all.
 *
 * `allowsEditing` + `quality` already cropped and compressed the image before
 * it got here, so there is nothing left to resize.
 */
export const prepareAvatarUpload = async (
  asset: ImagePickerAsset,
): Promise<PreparedAvatar> => {
  const { contentType, extension } = describeImageType(asset.mimeType);

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: "base64",
  });

  return {
    body: new Uint8Array(decodeBase64(base64)),
    contentType,
    extension,
    previewUri: asset.uri,
  };
};
