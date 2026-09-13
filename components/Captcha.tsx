import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { authStyles } from "../lib/formStyles";
import type { AppTheme } from "../lib/theme";

/**
 * Google reCAPTCHA v2 ("I'm not a robot") widget.
 *
 * IMPORTANT: this is a client-side gate only. Supabase Auth can verify just
 * hCaptcha and Turnstile tokens, so the token produced here is deliberately
 * NOT passed to Supabase as `options.captchaToken` — doing so would fail every
 * request the moment captcha protection is enabled in the Supabase dashboard.
 * It stops casual abuse through the UI; a scripted client calling Supabase
 * directly is not blocked. See README for what real enforcement would require.
 */

// DOM-only library: never let it load on native.
const WebRecaptcha =
  Platform.OS === "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("react-google-recaptcha").default as React.ComponentType<any>)
    : null;

const stripQuotes = (value: string) =>
  value.trim().replace(/^['"]|['"]$/g, "");

const SITE_KEY = stripQuotes(process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY || "");

const BASE_URL = stripQuotes(
  process.env.EXPO_PUBLIC_RECAPTCHA_BASE_URL ||
    process.env.EXPO_PUBLIC_APP_BASE_URL ||
    "",
);

export const CAPTCHA_CONFIGURED = SITE_KEY.length > 0;

export const CAPTCHA_ALLOWED_DOMAIN = BASE_URL.replace(/^https?:\/\//i, "")
  .split("/")[0]
  .toLowerCase();

/**
 * On native the challenge runs inside a WebView, and reCAPTCHA checks the
 * page's origin against the domains registered for the site key. That needs a
 * real HTTPS base URL.
 */
export const CAPTCHA_BASE_URL_MISCONFIGURED =
  Platform.OS !== "web" &&
  (!/^https:\/\//i.test(BASE_URL) || CAPTCHA_ALLOWED_DOMAIN.length === 0);

export const CAPTCHA_SETUP_HINT = !CAPTCHA_CONFIGURED
  ? "Set EXPO_PUBLIC_RECAPTCHA_SITE_KEY in .env to enable this action."
  : CAPTCHA_BASE_URL_MISCONFIGURED
    ? `Set EXPO_PUBLIC_RECAPTCHA_BASE_URL to an HTTPS domain and register ${CAPTCHA_ALLOWED_DOMAIN || "it"} in the Google reCAPTCHA console.`
    : null;

export type CaptchaHandle = {
  /** Clears the current token and re-arms the widget. Tokens are single-use. */
  reset: () => void;
};

type CaptchaGateProps = {
  theme: AppTheme;
  verified: boolean;
  onVerify: (token: string) => void;
  /** Called when the token becomes unusable (expired, errored, reset). */
  onInvalidate: (message: string | null) => void;
  label?: string;
};

const buildChallengeHtml = (siteKey: string, dark: boolean) => `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://www.google.com/recaptcha/api.js" async defer></script>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${dark ? "#111827" : "#f8fafc"};
        font-family: Arial, sans-serif;
      }
      .card {
        background: ${dark ? "#1f2937" : "#ffffff"};
        border: 1px solid ${dark ? "#374151" : "#e2e8f0"};
        border-radius: 12px;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div
        class="g-recaptcha"
        data-sitekey="${siteKey}"
        data-theme="${dark ? "dark" : "light"}"
        data-callback="onVerified"
        data-expired-callback="onExpired"
        data-error-callback="onError"
      ></div>
    </div>
    <script>
      function post(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      function onVerified(token) { post({ type: "verified", token: token }); }
      function onExpired() { post({ type: "expired" }); }
      function onError() { post({ type: "error" }); }
    </script>
  </body>
</html>`;

const CaptchaGateWeb = forwardRef<CaptchaHandle, CaptchaGateProps>(
  function CaptchaGateWeb({ theme, onVerify, onInvalidate }, ref) {
    const widgetRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      reset: () => widgetRef.current?.reset(),
    }));

    if (!WebRecaptcha) {
      return (
        <Text style={styles.hint}>The security check failed to load.</Text>
      );
    }

    return (
      <View style={styles.webWrap}>
        <WebRecaptcha
          ref={widgetRef}
          sitekey={SITE_KEY}
          theme={theme.name === "dark" ? "dark" : "light"}
          onChange={(token: string | null) => {
            if (token) {
              onVerify(token);
              return;
            }
            onInvalidate(null);
          }}
          onExpired={() =>
            onInvalidate("Security check expired. Please verify again.")
          }
          onErrored={() =>
            onInvalidate("Security check failed. Please try again.")
          }
        />
      </View>
    );
  },
);

const CaptchaGateNative = forwardRef<CaptchaHandle, CaptchaGateProps>(
  function CaptchaGateNative(
    { theme, verified, onVerify, onInvalidate, label },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    // Remounts the WebView so a consumed challenge starts over.
    const [attempt, setAttempt] = useState(0);

    useImperativeHandle(ref, () => ({
      reset: () => {
        setAttempt((value) => value + 1);
      },
    }));

    const handleMessage = useCallback(
      (rawData: string) => {
        try {
          const payload = JSON.parse(rawData || "{}");
          if (payload.type === "verified" && payload.token) {
            onVerify(payload.token);
            setVisible(false);
            return;
          }
          if (payload.type === "expired") {
            onInvalidate("Security check expired. Please verify again.");
            return;
          }
          if (payload.type === "error") {
            onInvalidate("Security check failed. Please try again.");
          }
        } catch {
          onInvalidate("Unable to process the security check result.");
        }
      },
      [onInvalidate, onVerify],
    );

    return (
      <>
        <Pressable
          onPress={() => {
            if (CAPTCHA_BASE_URL_MISCONFIGURED) {
              onInvalidate(CAPTCHA_SETUP_HINT);
              return;
            }
            setLoading(true);
            setVisible(true);
            onInvalidate(null);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: verified }}
          style={styles.nativeRow}
        >
          <View
            style={[
              authStyles.checkbox,
              verified && authStyles.checkboxChecked,
              {
                borderColor:
                  theme.name === "dark" ? "rgba(255, 255, 255, 0.4)" : "#94a3b8",
              },
            ]}
          >
            {verified ? (
              <Text style={authStyles.checkboxMark}>{"✓"}</Text>
            ) : null}
          </View>
          <Text style={styles.nativeLabel}>
            {label ?? "Verify you are a human"}
          </Text>
        </Pressable>

        <Modal
          visible={visible}
          animationType="slide"
          transparent
          onRequestClose={() => setVisible(false)}
        >
          <View style={authStyles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Security check</Text>
              <View style={styles.webviewWrap}>
                <WebView
                  key={attempt}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                  source={{
                    html: buildChallengeHtml(SITE_KEY, theme.name === "dark"),
                    baseUrl: BASE_URL,
                  }}
                  onLoadEnd={() => setLoading(false)}
                  onMessage={(event) => handleMessage(event.nativeEvent.data)}
                />
                {loading ? (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color="#2563eb" />
                  </View>
                ) : null}
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && authStyles.secondaryButtonPressed,
                ]}
                onPress={() => {
                  setVisible(false);
                  setLoading(true);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </>
    );
  },
);

export const CaptchaGate = forwardRef<CaptchaHandle, CaptchaGateProps>(
  function CaptchaGate(props, ref) {
    if (!CAPTCHA_CONFIGURED) {
      return <Text style={styles.hint}>{CAPTCHA_SETUP_HINT}</Text>;
    }

    return Platform.OS === "web" ? (
      <CaptchaGateWeb {...props} ref={ref} />
    ) : (
      <CaptchaGateNative {...props} ref={ref} />
    );
  },
);

const styles = StyleSheet.create({
  webWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    minHeight: 78,
  },
  nativeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  nativeLabel: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    height: 360,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
    textAlign: "center",
  },
  webviewWrap: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  closeButton: {
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  closeButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
  hint: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
  },
});
