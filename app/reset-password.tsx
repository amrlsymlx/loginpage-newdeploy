import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PasswordChecklist } from "../components/PasswordChecklist";
import {
  authStyles,
  getFormCardStyle,
  getInputStyle,
  getPlaceholderColor,
} from "../lib/formStyles";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { PASSWORD_POLICY_MESSAGE, validatePassword } from "../lib/validation";

type RecoveryParams = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  recoveryType: string | null;
};

const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.";

const REOPEN_LINK_MESSAGE =
  "Auth session expired. Reopen the password reset link from your email and try again.";

const extractRecoveryParams = (rawUrl: string): RecoveryParams => {
  const queryParams = new URLSearchParams();
  const hashParams = new URLSearchParams();

  const questionMarkIndex = rawUrl.indexOf("?");
  const hashIndex = rawUrl.indexOf("#");

  if (questionMarkIndex !== -1) {
    const queryString =
      hashIndex !== -1
        ? rawUrl.slice(questionMarkIndex + 1, hashIndex)
        : rawUrl.slice(questionMarkIndex + 1);
    const parsedQuery = new URLSearchParams(queryString);
    parsedQuery.forEach((value, key) => queryParams.set(key, value));
  }

  if (hashIndex !== -1) {
    const parsedHash = new URLSearchParams(rawUrl.slice(hashIndex + 1));
    parsedHash.forEach((value, key) => hashParams.set(key, value));
  }

  return {
    code: queryParams.get("code"),
    accessToken:
      queryParams.get("access_token") ?? hashParams.get("access_token"),
    refreshToken:
      queryParams.get("refresh_token") ?? hashParams.get("refresh_token"),
    tokenHash: queryParams.get("token_hash") ?? hashParams.get("token_hash"),
    recoveryType: queryParams.get("type") ?? hashParams.get("type"),
  };
};

export default function ResetPassword() {
  const router = useRouter();
  const { theme } = useTheme();
  const currentUrl = Linking.useURL();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preparingSession, setPreparingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");

  const passwordMeetsRules = validatePassword(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSavePassword =
    sessionReady &&
    !preparingSession &&
    !loading &&
    passwordMeetsRules &&
    passwordsMatch;

  /**
   * Turns whatever the recovery link carried into a live session. Supabase
   * recovery tokens are single-use server-side, so a link that has already
   * been redeemed fails here with its own message.
   */
  const redeemRecoveryLink = useCallback(async (): Promise<string | null> => {
    if (!SUPABASE_CONFIGURED || !supabase) {
      return SUPABASE_NOT_CONFIGURED_MESSAGE;
    }

    const { data: existingSessionData } = await supabase.auth.getSession();
    if (existingSessionData.session) {
      return null;
    }

    const urlToParse = currentUrl ?? (await Linking.getInitialURL());
    if (!urlToParse) {
      return REOPEN_LINK_MESSAGE;
    }

    const { code, accessToken, refreshToken, tokenHash, recoveryType } =
      extractRecoveryParams(urlToParse);

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return error.message || "Invalid or expired recovery link.";
      }
    } else if (tokenHash && (recoveryType === "recovery" || !recoveryType)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      if (error) {
        return error.message || "Invalid or expired recovery link.";
      }
    } else if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        return error.message || "Invalid or expired recovery link.";
      }
    } else {
      return "Password reset link is missing required credentials.";
    }

    const { data } = await supabase.auth.getSession();
    return data.session ? null : REOPEN_LINK_MESSAGE;
  }, [currentUrl]);

  useEffect(() => {
    let cancelled = false;

    const setupRecoverySession = async () => {
      const failure = await redeemRecoveryLink();

      if (cancelled) {
        return;
      }

      if (failure) {
        setStatus(failure);
        setPreparingSession(false);
        return;
      }

      const { data: userData } = await supabase!.auth.getUser();
      if (cancelled) {
        return;
      }

      setUserEmail(userData.user?.email || "");
      setSessionReady(true);
      setPreparingSession(false);
      setStatus("Recovery link verified. Set your new password.");
    };

    void setupRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [redeemRecoveryLink]);

  const closeCurrentWindow = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.close();

      // Some browsers block closing tabs not opened via script.
      if (!window.closed) {
        router.replace("/");
      }
      return;
    }

    router.replace("/");
  };

  const handleUpdatePassword = async () => {
    const client = supabase;
    if (!SUPABASE_CONFIGURED || !client) {
      setStatus(SUPABASE_NOT_CONFIGURED_MESSAGE);
      return;
    }
    if (!passwordMeetsRules) {
      setStatus(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!passwordsMatch) {
      setStatus("Passwords do not match.");
      return;
    }

    setLoading(true);
    setStatus(null);

    // The session can lapse while the form is being filled in.
    const failure = await redeemRecoveryLink();
    if (failure) {
      setLoading(false);
      setStatus(failure);
      return;
    }

    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setStatus(error.message || "Unable to update password.");
      return;
    }

    try {
      if (userEmail) {
        await client.functions.invoke("send-password-change-success-email", {
          body: { email: userEmail },
        });
      }
    } catch {
      // Ignore email notification failures in the reset-success UX.
    }

    setLoading(false);

    const successMessage = `Password reset is success for ${userEmail || "[email]"}, you may now close this window`;
    setStatus(successMessage);

    // Signing out invalidates the recovery session, so the link cannot be
    // reused to change the password a second time.
    const completeSuccess = async () => {
      try {
        await client.auth.signOut();
      } finally {
        closeCurrentWindow();
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(successMessage);
      await completeSuccess();
      return;
    }

    Alert.alert("Password reset successful", successMessage, [
      { text: "Okay", onPress: () => void completeSuccess() },
    ]);
  };

  const inputStyle = [authStyles.input, getInputStyle(theme)];
  const placeholderColor = getPlaceholderColor(theme);
  const fieldsDisabled = preparingSession || !sessionReady;

  return (
    <KeyboardAvoidingView
      style={[authStyles.keyboardView, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={[authStyles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={authStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[authStyles.container, { backgroundColor: theme.background }]}
        >
          <View style={[authStyles.formCard, getFormCardStyle(theme)]}>
            <View style={authStyles.heroWrap}>
              <Text style={[authStyles.title, { color: theme.text }]}>
                Reset password
              </Text>
              <Text
                style={[authStyles.subtitle, { color: theme.secondaryText }]}
              >
                Set a new password for {userEmail || "[email]"}
              </Text>
            </View>

            {status ? (
              <View style={authStyles.statusBox}>
                <Text style={authStyles.statusText}>{status}</Text>
              </View>
            ) : null}

            <View style={authStyles.passwordRow}>
              <TextInput
                style={[...inputStyle, authStyles.passwordInput]}
                placeholderTextColor={placeholderColor}
                placeholder="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!fieldsDisabled}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                disabled={fieldsDisabled}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color={theme.text}
                />
              </Pressable>
            </View>

            <PasswordChecklist password={password} />

            <View style={authStyles.passwordRow}>
              <TextInput
                style={[...inputStyle, authStyles.passwordInput]}
                placeholderTextColor={placeholderColor}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!fieldsDisabled}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                accessibilityLabel={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                disabled={fieldsDisabled}
              >
                <MaterialCommunityIcons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={22}
                  color={theme.text}
                />
              </Pressable>
            </View>

            {confirmPassword.length > 0 && !passwordsMatch ? (
              <Text style={authStyles.fieldError}>Passwords do not match.</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                authStyles.primaryButton,
                !canSavePassword && authStyles.primaryButtonDisabled,
                pressed && authStyles.primaryButtonPressed,
              ]}
              onPress={handleUpdatePassword}
              disabled={!canSavePassword}
            >
              <Text style={authStyles.primaryButtonText}>
                {loading
                  ? "Updating password..."
                  : preparingSession
                    ? "Preparing reset..."
                    : "Save new password"}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && authStyles.secondaryButtonPressed,
              ]}
              onPress={closeCurrentWindow}
            >
              <Text style={[styles.cancelText, { color: theme.secondaryText }]}>
                Cancel password reset
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cancelButton: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
