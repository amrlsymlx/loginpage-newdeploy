import { Platform, StyleSheet, TextStyle, ViewStyle } from "react-native";
import type { AppTheme } from "./theme";

/**
 * Styles shared by the four auth screens (sign in, sign up, forgot password,
 * reset password), which render the same card / input / button furniture.
 * Theme-dependent colours come from the helpers below.
 */
export const authStyles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 80,
    position: "relative",
  },
  formCard: {
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    // Web-only CSS; a no-op on native, so it is applied there only.
    ...Platform.select({ web: { backdropFilter: "blur(12px)" }, default: {} }),
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  primaryButton: {
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2563eb",
    marginBottom: 12,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
  },
  linkText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  fieldError: {
    color: "#c00",
    fontSize: 12,
    marginBottom: 8,
  },
  banner: {
    backgroundColor: "#fff3cd",
    borderColor: "#ffeeba",
    borderWidth: 1,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  bannerText: {
    fontSize: 12,
  },
  statusBox: {
    borderRadius: 6,
    backgroundColor: "#e8f4ff",
    borderWidth: 1,
    borderColor: "#b8d7f0",
    padding: 10,
    marginBottom: 12,
  },
  statusText: {
    color: "#075985",
    fontSize: 14,
    textAlign: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  checkboxMark: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
});

export const getFormCardStyle = (theme: AppTheme): ViewStyle => ({
  backgroundColor:
    theme.name === "dark" ? "rgba(31, 41, 55, 0.72)" : "rgba(255, 255, 255, 0.95)",
  borderWidth: Platform.OS === "android" ? 0 : 1,
  borderColor:
    Platform.OS === "android" ? "transparent" : "rgba(255, 255, 255, 0.25)",
});

export const getInputStyle = (theme: AppTheme): TextStyle => ({
  backgroundColor:
    theme.name === "dark" ? "rgba(17, 24, 39, 0.85)" : "rgba(255, 255, 255, 0.95)",
  borderColor:
    theme.name === "dark" ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.1)",
  color: theme.name === "dark" ? "#f9fafb" : "#111827",
});

export const getPlaceholderColor = (theme: AppTheme) =>
  theme.name === "dark" ? "#cbd5e1" : "#6b7280";
