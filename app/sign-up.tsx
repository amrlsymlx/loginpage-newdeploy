import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { PasswordChecklist } from "../components/PasswordChecklist";
import { SIGNUP_EMAIL_REDIRECT } from "../lib/authRedirect";
import { getRandomAvatarLibraryKey } from "../lib/avatarLibrary";
import {
  authStyles,
  getFormCardStyle,
  getInputStyle,
  getPlaceholderColor,
} from "../lib/formStyles";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import {
  PASSWORD_POLICY_MESSAGE,
  validateEmail,
  validatePassword,
} from "../lib/validation";

const DUPLICATE_EMAIL_MESSAGE =
  "An account with this email already exists. Please sign in instead.";

const isExistingUserError = (error: any) => {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code.includes("user_already_exists") ||
    code.includes("email_exists") ||
    code.includes("duplicate") ||
    code.includes("already_registered") ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("already in use") ||
    message.includes("duplicate")
  );
};

const isExistingUserFromSignUpData = (data: any, normalizedEmail: string) => {
  const user = data?.user;
  if (!user || data?.session) {
    return false;
  }

  const userEmail = String(user?.email ?? "")
    .trim()
    .toLowerCase();
  const identities = Array.isArray(user?.identities) ? user.identities : null;

  // Supabase may return a masked user-like payload for existing emails
  // when email confirmation is enabled, with no identities attached.
  return (
    userEmail === normalizedEmail.trim().toLowerCase() &&
    identities !== null &&
    identities.length === 0
  );
};

export default function SignUp() {
  const router = useRouter();
  const { theme } = useTheme();
  const captchaRef = useRef<CaptchaHandle>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");

  const isFormValid =
    name.trim().length > 0 &&
    validateEmail(email) &&
    validatePassword(password) &&
    password === confirmPassword &&
    agreeToTerms &&
    captchaToken.length > 0 &&
    CAPTCHA_CONFIGURED &&
    !!SUPABASE_CONFIGURED;

  // reCAPTCHA tokens are single-use, so a failed attempt needs a fresh one.
  const resetCaptcha = () => {
    setCaptchaToken("");
    captchaRef.current?.reset();
  };

  const reportFailure = (message: string) => {
    setStatus(message);
    resetCaptcha();

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`Registration failed: ${message}`);
      return;
    }

    Alert.alert(
      message === DUPLICATE_EMAIL_MESSAGE
        ? "Email already registered"
        : "Registration failed",
      message,
    );
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Missing fields", "Please fill all fields to register.");
      return;
    }

    const normalizedEmail = email.trim();
    if (!validateEmail(normalizedEmail)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert("Weak password", PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!agreeToTerms) {
      Alert.alert(
        "Terms required",
        "You must agree to the Terms and Conditions to sign up.",
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Please re-enter the same password twice.",
      );
      return;
    }
    if (!CAPTCHA_CONFIGURED) {
      setCaptchaError(CAPTCHA_SETUP_HINT ?? "");
      Alert.alert("Security check unavailable", CAPTCHA_SETUP_HINT ?? "");
      return;
    }
    if (!captchaToken) {
      setCaptchaError("Please complete the security check.");
      Alert.alert("Security check required", "Please complete the security check.");
      return;
    }

    if (!SUPABASE_CONFIGURED || !supabase) {
      const missingConfigMessage =
        "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.";
      setStatus(missingConfigMessage);
      Alert.alert("Supabase not configured", missingConfigMessage);
      return;
    }

    setCaptchaError("");
    setLoading(true);
    setStatus(null);

    try {
      // captchaToken is intentionally not forwarded: Supabase verifies only
      // hCaptcha and Turnstile, so sending a reCAPTCHA token would fail every
      // request once captcha protection is enabled. See components/Captcha.tsx.
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: SIGNUP_EMAIL_REDIRECT,
          data: {
            avatarPath: null,
            name,
            username: normalizedEmail.split("@")[0],
            role: "user",
            phoneNumber: "N/A",
            address: "N/A",
            avatarLibraryKey: getRandomAvatarLibraryKey(),
          },
        },
      });

      if (error) {
        const fromRateLimit =
          (error as any)?.code === "over_email_send_rate_limit" ||
          error.status === 429;
        reportFailure(
          fromRateLimit
            ? "Too many registration emails sent. Please wait a moment and try again."
            : isExistingUserError(error)
              ? DUPLICATE_EMAIL_MESSAGE
              : error.message || "Unable to register",
        );
        return;
      }

      if (isExistingUserFromSignUpData(data, normalizedEmail)) {
        reportFailure(DUPLICATE_EMAIL_MESSAGE);
        return;
      }

      if (!data.user && !data.session) {
        reportFailure(
          "We could not create your account. The email may already be registered or the request could not be completed.",
        );
        return;
      }

      const successMessage =
        "Registration Success, please check your mailbox and verify your email before signing in";
      setStatus(successMessage);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(successMessage);
      } else {
        Alert.alert("Registration Success", successMessage);
      }
      router.replace("/");
    } catch (err: any) {
      reportFailure(err?.message || "Failed to save account.");
    } finally {
      setLoading(false);
    }
  };

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
          style={[
            authStyles.container,
            styles.container,
            { backgroundColor: theme.background },
          ]}
        >
          <View style={[authStyles.formCard, getFormCardStyle(theme)]}>
            <View style={authStyles.heroWrap}>
              <Text style={[authStyles.title, { color: theme.text }]}>
                Create account
              </Text>
              <Text
                style={[authStyles.subtitle, { color: theme.secondaryText }]}
              >
                Join us and get started
              </Text>
            </View>

            {!SUPABASE_CONFIGURED ? (
              <View style={authStyles.banner}>
                <Text
                  style={[authStyles.bannerText, { color: theme.bannerText }]}
                >
                  Supabase is not configured. Add `EXPO_PUBLIC_SUPABASE_URL` and
                  `EXPO_PUBLIC_SUPABASE_ANON_KEY` to .env before registering.
                </Text>
              </View>
            ) : null}

            {status ? (
              <View style={authStyles.statusBox}>
                <Text style={authStyles.statusText}>{status}</Text>
              </View>
            ) : null}

            <TextInput
              style={inputStyle}
              placeholderTextColor={placeholderColor}
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <TextInput
              style={inputStyle}
              placeholderTextColor={placeholderColor}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {email.trim().length > 0 && !validateEmail(email) ? (
              <Text style={authStyles.fieldError}>
                Please enter a valid email address.
              </Text>
            ) : null}

            <View style={authStyles.passwordRow}>
              <TextInput
                style={[...inputStyle, authStyles.passwordInput]}
                placeholderTextColor={placeholderColor}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
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
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                accessibilityLabel={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <MaterialCommunityIcons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={22}
                  color={theme.text}
                />
              </Pressable>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword ? (
              <Text style={authStyles.fieldError}>Passwords do not match.</Text>
            ) : null}

            <View style={styles.termsRow}>
              <Pressable
                onPress={() => setAgreeToTerms((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreeToTerms }}
              >
                <View
                  style={[
                    authStyles.checkbox,
                    agreeToTerms && authStyles.checkboxChecked,
                  ]}
                >
                  {agreeToTerms ? (
                    <Text style={authStyles.checkboxMark}>{"✓"}</Text>
                  ) : null}
                </View>
              </Pressable>
              <Text style={[authStyles.checkboxLabel, { color: theme.text }]}>
                I agree to the{" "}
              </Text>
              <Pressable onPress={() => setShowTermsModal(true)}>
                <Text style={authStyles.linkText}>Terms &amp; Conditions</Text>
              </Pressable>
            </View>

            {agreeToTerms ? (
              <View style={styles.captchaBox}>
                <Text
                  style={[styles.captchaLabel, { color: theme.secondaryText }]}
                >
                  Security check
                </Text>
                <CaptchaGate
                  ref={captchaRef}
                  theme={theme}
                  verified={captchaToken.length > 0}
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setCaptchaError("");
                  }}
                  onInvalidate={(message) => {
                    setCaptchaToken("");
                    setCaptchaError(message ?? "");
                  }}
                />
                {captchaError ? (
                  <Text style={authStyles.fieldError}>{captchaError}</Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                authStyles.primaryButton,
                (loading || !isFormValid) && authStyles.primaryButtonDisabled,
                pressed && authStyles.primaryButtonPressed,
              ]}
              onPress={handleRegister}
              disabled={loading || !isFormValid}
            >
              <Text style={authStyles.primaryButtonText}>
                {loading ? "Creating..." : "Sign Up"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/")}
          >
            <Text style={authStyles.secondaryButtonText}>Back to Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={showTermsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={authStyles.modalOverlay}>
          <View
            style={[
              authStyles.modalCard,
              styles.termsCard,
              { backgroundColor: theme.surface },
            ]}
          >
            <Text style={[authStyles.modalTitle, { color: theme.text }]}>
              Terms &amp; Conditions
            </Text>
            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                By creating an account, you agree to use this app responsibly
                and comply with all applicable laws.
              </Text>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activities performed under your
                account.
              </Text>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                We may update these terms from time to time. Continued use of
                the app after updates means you accept the revised terms.
              </Text>
            </ScrollView>
            <Pressable
              style={({ pressed }) => [
                authStyles.primaryButton,
                pressed && authStyles.primaryButtonPressed,
              ]}
              onPress={() => setShowTermsModal(false)}
            >
              <Text style={authStyles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "flex-start",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
    marginBottom: 12,
  },
  captchaBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  captchaLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  backButton: {
    marginTop: 12,
    alignItems: "center",
  },
  termsCard: {
    maxHeight: "80%",
  },
  modalBody: {
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
});
