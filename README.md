# TestApp (Login page skeleton)

A cross-platform (iOS / Android / Web) authentication + dashboard starter built with **Expo Router** and **Supabase Auth**. It covers the full account lifecycle — sign up with email verification, sign in, "remember me", forgot/reset password, profile editing with avatar upload, and a themeable dashboard shell with a swipe-open drawer.

## Overview

- **What it is**: A production-shaped login/dashboard template, not a toy demo. It handles the annoying edges of auth UX — expired verification links, resend flows, session persistence choices, token refresh while backgrounded, avatar signed URLs, light/dark theming — that most starter kits skip.
- **Backend**: [Supabase](https://supabase.com) (Postgres + Auth + Storage). There is no custom server; the Expo app talks to Supabase directly via `@supabase/supabase-js`.
- **Bot protection**: Google reCAPTCHA v2 on sign-up and forgot-password — a **client-side UI gate only** (see [Architecture](#architecture) for why it isn't wired to Supabase's server-side captcha check).
- **Analytics**: Vercel Analytics, mounted at the app root.
- **Platforms**: iOS, Android, and Web (exported as a static site) from one codebase via `expo-router`.

## Flow

### 1. Sign in (`app/index.tsx`)
- Every cold app launch lands here — an existing Supabase session is **never** used to auto-skip to the dashboard.
- "Remember me" only pre-fills the email/password fields from local storage (`lib/storage.ts`); it never persists the raw password past that. Actual session persistence is controlled separately by "Keep me signed in" (see below).
- This screen also doubles as the landing point for email-verification deep links (`?code=`, `#access_token=`, `token_hash=`, etc.) — it detects the link, exchanges/verifies it with Supabase, signs the just-verified session back out, and shows a success/error banner so the user can log in normally.
- On success it builds a `Profile` from the Supabase user, persists it locally, and routes to `/dashboard`.

### 2. Sign up (`app/sign-up.tsx`)
- Validates email + password strength (`lib/validation.ts`, checklist UI in `components/PasswordChecklist.tsx`).
- Requires passing a reCAPTCHA v2 checkbox challenge (`components/Captcha.tsx`) before the submit button unlocks.
- Calls `supabase.auth.signUp`, detects "already registered" responses (Supabase masks these), and redirects the user to email verification.
- A confirmation email (Supabase's own template) links back to `EXPO_PUBLIC_SIGNUP_REDIRECT_URL`, which the sign-in screen's deep-link handler consumes.

### 3. Forgot / reset password (`app/forgot-password.tsx`, `app/reset-password.tsx`)
- Forgot-password also sits behind the reCAPTCHA gate and calls `supabase.auth.resetPasswordForEmail`.
- The reset link opens the app via the `vcode://reset-password` scheme (native) or the web reset URL, where the user sets a new password.
- After a successful reset, the app invokes a Supabase Edge Function (`send-password-change-success-email`) to send a confirmation email.

### 4. Dashboard (`app/dashboard/*`)
- `app/dashboard/_layout.tsx` is a session guard **and** the shell: on focus it calls `loadProfile()`, which always re-validates against the live Supabase session (never trusts a cached profile to grant access). A `SIGNED_OUT` auth event (e.g. token expiry) bounces the user straight back to `/`.
- Provides a custom swipe/tap drawer (profile summary, Settings, Sign out) built with `PanResponder` + `Animated`, plus a bottom tab bar (`Home`, `Create`); `Settings` and `Edit profile` are reachable from the drawer/settings but hidden from the tab bar.
- `edit-profile.tsx` lets the user update name/phone/address/username and either upload a custom avatar (Supabase Storage, signed URL) or pick one from a built-in avatar library.
- `settings.tsx` exposes sign-out and the edit-profile entry point.

### 5. Sign out
- Clears the Supabase session (`supabase.auth.signOut()`) and the local cached session (`clearAuthSession()`), then routes back to `/`.

```
Sign In ──► (new user) Sign Up ──► Email verification link ──► back to Sign In
   │
   ├─► Forgot Password ──► Email reset link ──► Reset Password ──► Sign In
   │
   └─► (valid credentials) ──► Dashboard (Home / Create / Settings / Edit Profile) ──► Sign Out ──► Sign In
```

## Architecture

```
app/                        Expo Router file-based routes (screens)
├─ _layout.tsx               Root stack, font/theme bootstrap, Analytics mount
├─ index.tsx                 Sign in + email-verification deep-link handler
├─ sign-up.tsx                Sign up
├─ forgot-password.tsx       Request password reset
├─ reset-password.tsx        Set new password
└─ dashboard/
   ├─ _layout.tsx             Session guard, drawer shell, tab navigator
   ├─ index.tsx                Home tab
   ├─ create.tsx               Create tab (placeholder)
   ├─ settings.tsx             Settings tab (hidden from tab bar)
   └─ edit-profile.tsx         Profile editing + avatar upload

components/                 Reusable UI
├─ Captcha.tsx                reCAPTCHA v2 (react-google-recaptcha on web, WebView on native)
├─ PasswordChecklist.tsx      Live password-policy checklist
└─ dashboard/                 Drawer/Profile React Context + shared avatar geometry constants

lib/                        Platform-agnostic app logic (no UI)
├─ supabase.ts                Supabase client singleton + native background token refresh
├─ profile.ts                 Builds/loads/validates the app's Profile shape from a Supabase user
├─ authStorage.ts              Supabase auth storage adapter (SecureStore/localStorage, chunked, memory-first)
├─ storage.ts                  Local session cache + "remember me" credential storage
├─ authRedirect.ts             Computes signup/reset redirect URLs from env
├─ avatarLibrary.ts             Built-in avatar set (deterministic pick by email)
├─ avatarUpload.ts / .web.ts    Platform-specific image-picker-to-bytes prep (native vs. web)
├─ validation.ts                Email/password validation rules
├─ theme.tsx                    Light/dark theme definitions, ThemeProvider, ThemeToggle
├─ formStyles.ts                Shared auth-form styling
├─ notify.ts                    Cross-platform alert/notify helper
└─ analytics.tsx / .web.tsx / .types.ts   Vercel Analytics wrapper (native no-op, real on web)
```

**Key design decisions:**
- **No custom backend.** All auth, data, and file storage go straight to Supabase from the client using the public anon key; there is no API layer in this repo.
- **Session vs. "remember me" are separate concerns.** "Remember me" (sign-in screen) only pre-fills the form. "Keep me signed in" (persistence flag in `authStorage.ts`) decides whether Supabase's refresh token survives an app restart (SecureStore/localStorage) or lives only in memory.
- **Profile is always re-derived from a live session**, never trusted from a stale cache, except as a short-lived fallback when Supabase is transiently unreachable (`profileFromCachedSession` in `lib/profile.ts`) — and even then only after a stored session already proved the user authenticated.
- **reCAPTCHA is a UX deterrent, not a security boundary.** Supabase Auth only verifies hCaptcha/Turnstile tokens server-side, so the token here is deliberately not sent to Supabase — a scripted client hitting Supabase directly bypasses it. Real enforcement would require switching providers or moving sign-up/reset behind an Edge Function.
- **Native vs. web split modules** (`avatarUpload.ts`/`.web.ts`, `analytics.tsx`/`.web.tsx`) let Metro pick the right implementation per platform via Expo/Metro's platform-extension resolution, avoiding runtime `Platform.OS` branching for browser-only or native-only APIs.

## Tech Stacks

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) 57 / React Native 0.86, [Expo Router](https://docs.expo.dev/router/introduction/) 57 (file-based routing, typed routes) |
| UI | React 19, React Native core components, `@expo/vector-icons` (Material Community Icons), `react-native-reanimated` / `react-native-worklets`, `react-native-gesture-handler`, `react-native-svg` |
| Backend-as-a-Service | [Supabase](https://supabase.com) — Auth (email/password, email verification, password reset), Storage (avatar uploads), Edge Functions (password-change email) |
| Bot protection | Google reCAPTCHA v2, via `react-google-recaptcha` (web) / WebView-hosted `api.js` (native) |
| Session storage | `expo-secure-store` (native, chunked) / `localStorage` (web) |
| Media | `expo-image-picker`, `expo-image`, `expo-file-system`, `base64-arraybuffer` |
| Analytics | `@vercel/analytics` |
| Language/tooling | TypeScript, ESLint (`eslint-config-expo`) |
| Deployment | Static web export (`expo export -p web`) → any static host; native builds via EAS/`expo run:ios`/`expo run:android` |

## Input & Output

| Screen / Flow | Input | Output |
|---|---|---|
| Sign In | Email, password, "Remember me" checkbox | Authenticated Supabase session → redirect to `/dashboard`; or inline error/verification banner |
| Sign Up | Email, password, reCAPTCHA token | New Supabase user (email-verification pending) → verification email sent |
| Email verification (deep link) | `code` / `token_hash` / `access_token`+`refresh_token` in the redirect URL | Verified account (session cleared again) → success/error banner on Sign In |
| Forgot Password | Email, reCAPTCHA token | Password-reset email sent (if the account exists) |
| Reset Password | New password (from reset link) | Updated Supabase password + confirmation email via Edge Function |
| Edit Profile | Name, phone, address, username, avatar (photo library/camera or built-in avatar) | Updated Supabase user metadata; avatar stored in Supabase Storage (`avatars` bucket) or a library key, resolved to a signed URL |
| Sign Out | — (button press) | Supabase session + local session cache cleared → redirect to `/` |

## How to set up this project on other device

### Prerequisites
- Node.js (LTS) and npm
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Google reCAPTCHA v2](https://www.google.com/recaptcha/admin) "I'm not a robot" site
- Expo CLI comes via `npx`, no global install required
- For native builds: Xcode (iOS) and/or Android Studio (Android), or just use [Expo Go](https://expo.dev/go) for quick testing

### Steps

1. **Clone and install dependencies**
   ```bash
   git clone <repo-url>
   cd loginpage-newdeploy
   npm install
   ```

2. **Create the Supabase backend**
   - Create a new Supabase project.
   - Under **Authentication → URL Configuration**, add the redirect URL: `vcode://reset-password` (and your deployed web domain equivalents).
   - Create a Storage bucket named `avatars` and apply the policies described in [docs/supabase-storage-setup.md](docs/supabase-storage-setup.md).
   - Deploy the `send-password-change-success-email` Edge Function (accepts `{ "email": "user@example.com" }`) so post-reset confirmation emails work.

3. **Register a reCAPTCHA v2 site**
   - At [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin), create a **v2 "I'm not a robot" checkbox** site.
   - Add every hostname the app will run on: your deployed domain, `localhost`, and the host used for `EXPO_PUBLIC_RECAPTCHA_BASE_URL`.

4. **Configure environment variables**

   Create a `.env` file in the project root:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   EXPO_PUBLIC_APP_BASE_URL=https://your-domain.com
   EXPO_PUBLIC_RECAPTCHA_SITE_KEY=your-google-recaptcha-v2-site-key

   # Optional overrides — all default to values derived from APP_BASE_URL
   # EXPO_PUBLIC_RECAPTCHA_BASE_URL=https://your-domain.com
   # EXPO_PUBLIC_SIGNUP_REDIRECT_URL=https://your-domain.com/
   # EXPO_PUBLIC_RESET_REDIRECT_URL=https://your-domain.com/reset-password
   ```
   `EXPO_PUBLIC_*` values are inlined at build time — restart with `npx expo start --clear` after changing any of them. **Never commit `.env`** (it's already git-ignored); treat the anon key as public-but-scoped and rely on Supabase Row Level Security for real protection.

5. **Run the app**
   ```bash
   npx expo start
   ```
   Then choose a target from the Expo CLI output:
   - Press `w` for web (or `npm run web`)
   - Press `a` / `i` for an Android/iOS emulator (`npm run android` / `npm run ios`), or scan the QR code with [Expo Go](https://expo.dev/go)

6. **Build for the web (static export)**
   ```bash
   npm run build:web
   ```
   Serves a static site (one HTML file per route) from `dist/` — do **not** enable SPA rewrites, they'd collapse every route to the index page.

7. **(Optional) Native production builds** — follow Expo's [development build](https://docs.expo.dev/develop/development-builds/introduction/) or [EAS Build](https://docs.expo.dev/build/introduction/) docs for signed iOS/Android binaries.

### Notes
- The reCAPTCHA challenge is client-side only — read the [Bot protection](#tech-stacks) note above before relying on it for real abuse prevention.
- "Keep me signed in" controls where the Supabase refresh token lives; passwords themselves are never stored on-device.
- This project targets **Expo SDK 57** — consult the versioned docs at `docs.expo.dev/versions/v54.0.0/` referenced in this repo's `AGENTS.md` only if working against an older SDK baseline; otherwise use the SDK 57 docs matching `package.json`.
