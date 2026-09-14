import { Alert, Platform } from "react-native";

/**
 * react-native-web ships `Alert.alert` as an empty no-op, so every
 * `Alert.alert(...)` call silently disappears in the browser — including the
 * ones that report why an avatar upload failed. Route through this helper so
 * web users actually see the message.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }

  Alert.alert(title, message);
}
