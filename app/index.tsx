import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { SIGNUP_EMAIL_REDIRECT } from "../lib/authRedirect";
import { setAuthPersistence } from "../lib/authStorage";
import {
  authStyles,
  getFormCardStyle,
  getInputStyle,
  getPlaceholderColor,
} from "../lib/formStyles";
import { buildProfileFromUser, persistProfile } from "../lib/profile";
import {
  clearRememberedCredentials,
  getRememberedCredentials,
  setRememberedCredentials,
} from "../lib/storage";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { validateEmail, validateSignInPassword } from "../lib/validation";

type EmailVerificationParams = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

type VerificationBannerState = {
  tone: "error" | "success";
  message: string;
  allowResend: boolean;
};

const extractEmailVerificationParams = (
  rawUrl: string,
): EmailVerificationParams => {
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
    code: queryParams.get("code") ?? hashParams.get("code"),
    tokenHash: queryParams.get("token_hash") ?? hashParams.get("token_hash"),
    type: queryParams.get("type") ?? hashParams.get("type"),
    accessToken:
      queryParams.get("access_token") ?? hashParams.get("access_token"),
    refreshToken:
      queryParams.get("refresh_token") ?? hashParams.get("refresh_token"),
    errorCode: queryParams.get("error_code") ?? hashParams.get("error_code"),
    errorDescription:
      queryParams.get("error_description") ??
      hashParams.get("error_description") ??
      queryParams.get("error") ??
      hashParams.get("error"),
  };
};

const isVerificationUrl = (params: EmailVerificationParams) =>
  params.type === "signup" ||
  Boolean(params.code) ||
  Boolean(params.tokenHash) ||
  Boolean(params.accessToken && params.refreshToken) ||
  Boolean(params.errorCode || params.errorDescription);

const shouldOfferVerificationResend = (
  errorCode: string | null,
  errorDescription: string | null,
) =>
  errorCode === "otp_expired" ||
  /expired|invalid/i.test(errorDescription ?? "");

const clearProcessedAuthUrl = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname);
};

export default function Index() {
  const router = useRouter();
  const { theme } = useTheme();
  const currentUrl = Linking.useURL();
  const processedVerificationUrlRef = useRef<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationBanner, setVerificationBanner] =
    useState<VerificationBannerState | null>(null);

  const formValid = validateEmail(email) && validateSignInPassword(password);
  const emailError = emailTouched && !validateEmail(email);

  const handleLogin = async () => {
    setEmailTouched(true);
    setError("");

    if (!validateEmail(email) || !validateSignInPassword(password)) {
      setError("Please fix validation errors before signing in.");
      return;
    }

    if (!SUPABASE_CONFIGURED || !supabase) {
      Alert.alert(
        "Supabase not configured",
        "Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env before signing in.",
      );
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim();

      // Auth never survives an app restart; only "Remember me" (handled
      // below) persists anything across launches.
      await setAuthPersistence(false);

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (signInError) {
        setError(signInError.message || "Sign-in failed");
        return;
      }

      const user = data.user ?? data.session?.user;
      if (!user) {
        setError("Sign-in failed");
        return;
      }

      const profile = await buildProfileFromUser(user);
      await persistProfile(profile, false);

      if (rememberMe) {
        await setRememberedCredentials({ email: normalizedEmail, password });
      } else {
        await clearRememberedCredentials();
      }

      setEmail("");
      setPassword("");
      setEmailTouched(false);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setEmailTouched(true);
    setError("");

    const normalizedEmail = email.trim();
    if (!validateEmail(normalizedEmail)) {
      setVerificationBanner({
        tone: "error",
        message:
          "Enter the email address you used to register, then request a new verification link.",
        allowResend: true,
      });
      return;
    }

    if (!SUPABASE_CONFIGURED || !supabase) {
      setVerificationBanner({
        tone: "error",
        message:
          "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.",
        allowResend: true,
      });
      return;
    }

    setResendingVerification(true);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: SIGNUP_EMAIL_REDIRECT,
      },
    });

    setResendingVerification(false);

    if (resendError) {
      const fromRateLimit =
        resendError.code === "over_email_send_rate_limit" ||
        resendError.status === 429;
      setVerificationBanner({
        tone: "error",
        message: fromRateLimit
          ? "Too many verification emails were sent. Please wait a moment and try again."
          : resendError.message || "Unable to send a new verification link.",
        allowResend: true,
      });
      return;
    }

    setVerificationBanner({
      tone: "success",
      message: `A new verification link has been sent to ${normalizedEmail}.`,
      allowResend: false,
    });
  };

  // Every app launch lands on this login screen; a prior Supabase session is
  // never used to skip straight to the dashboard. "Remember me" only
  // pre-fills the form fields below.
  useEffect(() => {
    let cancelled = false;

    const restoreForm = async () => {
      const remembered = await getRememberedCredentials();
      if (!cancelled && remembered) {
        setEmail(remembered.email);
        setPassword(remembered.password);
        setRememberMe(true);
      }

      if (!cancelled) {
        setCheckingSession(false);
      }
    };

    void restoreForm();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleEmailVerification = async () => {
      if (!SUPABASE_CONFIGURED || !supabase) {
        return;
      }

      const initialUrl = await Linking.getInitialURL();
      const urlToParse = currentUrl ?? initialUrl;

      if (!urlToParse || processedVerificationUrlRef.current === urlToParse) {
        return;
      }

      const params = extractEmailVerificationParams(urlToParse);
      if (!isVerificationUrl(params)) {
        return;
      }

      const {
        code,
        tokenHash,
        accessToken,
        refreshToken,
        errorCode,
        errorDescription,
      } = params;

      processedVerificationUrlRef.current = urlToParse;
      clearProcessedAuthUrl();

      let verificationError: string | null = null;

      if (errorDescription) {
        verificationError = errorDescription;
      } else if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          // The client may have already consumed the code from the URL, in
          // which case a live session means verification did succeed.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            verificationError = exchangeError.message || "Unable to verify email.";
          }
        }
      } else if (tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "signup",
        });
        if (otpError) {
          verificationError = otpError.message || "Unable to verify email.";
        }
      } else if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          verificationError = sessionError.message || "Unable to verify email.";
        }
      } else {
        // Some providers redirect back with type=signup but without verifiable
        // tokens. Do not show a false failure in that case.
        return;
      }

      if (verificationError) {
        setVerificationBanner({
          tone: "error",
          message: `Email verification failed: ${verificationError}`,
          allowResend: shouldOfferVerificationResend(
            errorCode,
            verificationError,
          ),
        });
        return;
      }

      await supabase.auth.signOut();

      setVerificationBanner({
        tone: "success",
        message:
          "Email verification success, you can now login using your credential.",
        allowResend: false,
      });
    };

    void handleEmailVerification();
  }, [currentUrl]);

  if (checkingSession) {
    return null;
  }

  const inputStyle = [authStyles.input, getInputStyle(theme)];
  const placeholderColor = getPlaceholderColor(theme);

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
                Welcome back
              </Text>
              <Text
                style={[authStyles.subtitle, { color: theme.secondaryText }]}
              >
                Sign in to continue
              </Text>
            </View>

            {!SUPABASE_CONFIGURED ? (
              <View style={authStyles.banner}>
                <Text
                  style={[authStyles.bannerText, { color: theme.bannerText }]}
                >
                  Supabase is not configured. Add `EXPO_PUBLIC_SUPABASE_URL` and
                  `EXPO_PUBLIC_SUPABASE_ANON_KEY` to .env and restart the app.
                </Text>
              </View>
            ) : null}

            {verificationBanner ? (
              <View
                style={[
                  styles.verificationBanner,
                  verificationBanner.tone === "error"
                    ? styles.verificationBannerError
                    : styles.verificationBannerSuccess,
                ]}
              >
                <Text style={styles.verificationBannerText}>
                  {verificationBanner.message}
                </Text>
                {verificationBanner.allowResend ? (
                  <Text style={styles.verificationBannerHint}>
                    Enter your email below to request a new verification link.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <TextInput
              style={inputStyle}
              placeholderTextColor={placeholderColor}
              placeholder="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError("");
              }}
              onBlur={() => setEmailTouched(true)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailError ? (
              <Text style={authStyles.fieldError}>
                {email ? "Enter a valid email address" : "Email is required"}
              </Text>
            ) : null}

            {verificationBanner?.allowResend ? (
              <Pressable
                style={({ pressed }) => [
                  authStyles.secondaryButton,
                  (resendingVerification || !SUPABASE_CONFIGURED) &&
                    authStyles.secondaryButtonDisabled,
                  pressed && authStyles.secondaryButtonPressed,
                ]}
                onPress={handleResendVerification}
                disabled={resendingVerification || !SUPABASE_CONFIGURED}
              >
                <Text style={authStyles.secondaryButtonText}>
                  {resendingVerification
                    ? "Sending new link..."
                    : "Request new verification link"}
                </Text>
              </Pressable>
            ) : null}

            <View style={authStyles.passwordRow}>
              <TextInput
                style={[...inputStyle, authStyles.passwordInput]}
                placeholderTextColor={placeholderColor}
                placeholder="Password"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) setError("");
                }}
                secureTextEntry={!showPassword}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                style={({ pressed }) => [
                  { padding: 6, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color={theme.text}
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.forgotPasswordButton,
                pressed && authStyles.secondaryButtonPressed,
              ]}
              onPress={() => router.push("/forgot-password")}
              disabled={!SUPABASE_CONFIGURED}
            >
              <Text style={styles.forgotPasswordButtonText}>
                Forgot password?
              </Text>
            </Pressable>

            {error ? (
              <Text style={[styles.error, { color: theme.error }]}>
                {error}
              </Text>
            ) : null}

            <View style={authStyles.checkboxRow}>
              <Pressable
                onPress={() => setRememberMe((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View
                  style={[
                    authStyles.checkbox,
                    rememberMe && authStyles.checkboxChecked,
                  ]}
                >
                  {rememberMe ? (
                    <Text style={authStyles.checkboxMark}>{"✓"}</Text>
                  ) : null}
                </View>
              </Pressable>
              <Text style={[authStyles.checkboxLabel, { color: theme.text }]}>
                Remember me
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                authStyles.primaryButton,
                (loading || !formValid || !SUPABASE_CONFIGURED) &&
                  authStyles.primaryButtonDisabled,
                pressed && authStyles.primaryButtonPressed,
              ]}
              onPress={handleLogin}
              disabled={loading || !formValid || !SUPABASE_CONFIGURED}
            >
              <Text style={authStyles.primaryButtonText}>
                {loading ? "Signing in..." : "Sign In"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: theme.text }]}>
              Don&apos;t have an account yet?{" "}
            </Text>
            <Pressable onPress={() => router.push("/sign-up")}>
              <Text style={authStyles.linkText}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  error: {
    marginBottom: 8,
    textAlign: "center",
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: 10,
    marginBottom: 4,
  },
  forgotPasswordButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 8,
  },
  signUpText: {
    fontSize: 14,
  },
  verificationBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  verificationBannerError: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  verificationBannerSuccess: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  verificationBannerText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  verificationBannerHint: {
    color: "#374151",
    fontSize: 12,
    marginTop: 6,
  },
});
