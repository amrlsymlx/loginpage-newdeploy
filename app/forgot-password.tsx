import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
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
import {
  CAPTCHA_CONFIGURED,
  CAPTCHA_SETUP_HINT,
  CaptchaGate,
  CaptchaHandle,
} from "../components/Captcha";
import { RESET_PASSWORD_REDIRECT } from "../lib/authRedirect";
import {
  authStyles,
  getFormCardStyle,
  getInputStyle,
  getPlaceholderColor,
} from "../lib/formStyles";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { validateEmail } from "../lib/validation";

export default function ForgotPassword() {
  const router = useRouter();
  const { theme } = useTheme();
  const captchaRef = useRef<CaptchaHandle>(null);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");

  const isEmailValid = validateEmail(email);
  const emailError = emailTouched && !isEmailValid;
  const canSendResetEmail =
    isEmailValid &&
    captchaToken.length > 0 &&
    !loading &&
    SUPABASE_CONFIGURED &&
    CAPTCHA_CONFIGURED;

  const handleSendResetEmail = async () => {
    setEmailTouched(true);
    setStatus("");

    const normalizedEmail = email.trim();
    if (!validateEmail(normalizedEmail)) {
      setStatus("Please enter a valid email address.");
      return;
    }
    if (!CAPTCHA_CONFIGURED) {
      setStatus(CAPTCHA_SETUP_HINT ?? "");
      return;
    }
    if (!captchaToken) {
      setStatus("Please complete the security check.");
      return;
    }
    if (!SUPABASE_CONFIGURED || !supabase) {
      Alert.alert(
        "Supabase not configured",
        "Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env before resetting your password.",
      );
      return;
    }

    setLoading(true);
    // captchaToken is intentionally not forwarded: Supabase verifies only
    // hCaptcha and Turnstile, so sending a reCAPTCHA token would fail every
    // request once captcha protection is enabled. See components/Captcha.tsx.
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: RESET_PASSWORD_REDIRECT,
      },
    );
    setLoading(false);

    // The token is single-use, so re-arm the widget either way.
    setCaptchaToken("");
    captchaRef.current?.reset();

    if (error) {
      const fromRateLimit =
        error.code === "over_email_send_rate_limit" || error.status === 429;
      setStatus(
        fromRateLimit
          ? "Too many password reset requests. Please wait a moment and try again."
          : error.message || "Failed to send reset password email.",
      );
      return;
    }

    const successMessage = `The reset password email is sent to ${normalizedEmail} if it registered with us`;
    setStatus(successMessage);
    Alert.alert("Reset password", successMessage);
  };

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
            <Text style={[authStyles.title, { color: theme.text }]}>
              Forgot password
            </Text>
            <Text
              style={[
                authStyles.subtitle,
                styles.subtitle,
                { color: theme.secondaryText },
              ]}
            >
              Enter your email to receive a reset link.
            </Text>

            <TextInput
              style={[authStyles.input, getInputStyle(theme)]}
              placeholderTextColor={getPlaceholderColor(theme)}
              placeholder="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (status) setStatus("");
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

            {isEmailValid ? (
              <View style={styles.captchaWrap}>
                <CaptchaGate
                  ref={captchaRef}
                  theme={theme}
                  verified={captchaToken.length > 0}
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setStatus("");
                  }}
                  onInvalidate={(message) => {
                    setCaptchaToken("");
                    if (message) setStatus(message);
                  }}
                />
              </View>
            ) : null}

            {status ? (
              <Text
                style={[
                  styles.status,
                  { color: theme.name === "dark" ? "#fef3c7" : "#075985" },
                ]}
              >
                {status}
              </Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                authStyles.primaryButton,
                !canSendResetEmail && authStyles.primaryButtonDisabled,
                pressed && authStyles.primaryButtonPressed,
              ]}
              onPress={handleSendResetEmail}
              disabled={!canSendResetEmail}
            >
              <Text style={authStyles.primaryButtonText}>
                {loading ? "Sending..." : "Send reset email"}
              </Text>
            </Pressable>

            {CAPTCHA_SETUP_HINT ? (
              <Text style={styles.hint}>{CAPTCHA_SETUP_HINT}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && authStyles.secondaryButtonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back to sign in</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginBottom: 16,
  },
  captchaWrap: {
    marginBottom: 12,
    alignItems: "center",
  },
  status: {
    textAlign: "center",
    marginBottom: 8,
  },
  hint: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  backButton: {
    alignSelf: "center",
    marginTop: 12,
  },
  backButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
