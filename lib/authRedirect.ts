import * as Linking from "expo-linking";

const sanitizeRedirect = (value: string) =>
  value.trim().replace(/^['"]|['"]$/g, "");

const normalizeHttpsUrl = (value: string) =>
  sanitizeRedirect(value).replace(/^https:\/\/https:\/\//i, "https://");

const appendPath = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/+$/g, "")}${path}`;

const APP_BASE_URL = normalizeHttpsUrl(process.env.EXPO_PUBLIC_APP_BASE_URL || "");

export const SIGNUP_EMAIL_REDIRECT =
  normalizeHttpsUrl(process.env.EXPO_PUBLIC_SIGNUP_REDIRECT_URL || "") ||
  (APP_BASE_URL ? appendPath(APP_BASE_URL, "/") : "") ||
  Linking.createURL("/");

export const RESET_PASSWORD_REDIRECT =
  normalizeHttpsUrl(process.env.EXPO_PUBLIC_RESET_REDIRECT_URL || "") ||
  (APP_BASE_URL ? appendPath(APP_BASE_URL, "/reset-password") : "") ||
  Linking.createURL("/reset-password");
