# Login & Auth Platform (loginpage-newdeploy)

Cross-platform (iOS / Android / web) auth + dashboard starter: Expo Router + Supabase Auth, no custom backend. Sign up with email verification, sign in, "keep me signed in", forgot/reset password, profile editing with avatar upload, themeable dashboard with a swipe drawer. Web is exported statically and deployed on Vercel (live: https://loginpage-newdeploy.vercel.app). Package name is `vcode`, URL scheme `vcode://`.

## Expo has changed

Your training data is out of date. This project is on **Expo SDK 57** (React Native 0.86, React 19.2, TypeScript 6, `typedRoutes` + React Compiler enabled). Read the docs for that version before writing Expo, Expo Router or React Native code: https://docs.expo.dev/versions/latest/

## Commands

- `npm start` – dev server (`npx expo start --clear` after changing any `EXPO_PUBLIC_*` value; they are inlined at build time)
- `npm run web` / `npm run android` / `npm run ios` – run on a platform
- `npm run build:web` – static export (`expo export -p web`) to `dist/`
- `npm run lint` – `expo lint`; run after changes and fix what you introduced

There is no test suite.

## Layout

- `app/` – Expo Router screens: `index.tsx` (sign in **and** email-verification deep-link handler), `sign-up.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `dashboard/` (`_layout.tsx` = session guard + drawer + tabs, `index`, `create`, `settings`, `edit-profile`)
- `components/` – `Captcha.tsx` (reCAPTCHA v2: `react-google-recaptcha` on web, WebView on native), `PasswordChecklist.tsx`, `dashboard/` (Drawer/Profile contexts, avatar geometry constants)
- `lib/` – all non-UI logic:
  - `supabase.ts` – client singleton; native-only AppState hook that starts/stops auto token refresh
  - `authStorage.ts` – Supabase auth storage adapter (SecureStore native / localStorage web, chunked, memory-first)
  - `storage.ts` – local session cache + "remember me" email/password prefill
  - `profile.ts` – builds/validates the app `Profile` from a Supabase user
  - `authRedirect.ts` – signup/reset redirect URLs derived from env
  - `avatarLibrary.ts`, `avatarUpload.ts` / `.web.ts` / `.types.ts` – built-in avatars and platform-specific upload prep
  - `analytics.tsx` / `.web.tsx` / `.types.ts` – Vercel Analytics (no-op on native)
  - `theme.tsx`, `formStyles.ts`, `validation.ts`, `notify.ts`
- `docs/supabase-storage-setup.md` – `avatars` bucket and policy setup

## Code style and conventions

1. **Cross-platform first.** Anything browser-only or native-only goes in a platform-suffixed file (`.web.ts` / `.native.ts`), following the existing `avatarUpload` / `analytics` pattern, not `Platform.OS` branches scattered through screens.
2. **Use `notify()` from `lib/notify.ts`, never `Alert.alert` directly.** react-native-web's `Alert.alert` is a silent no-op.
3. **Never trust a cached profile for access.** `dashboard/_layout.tsx` re-validates against the live Supabase session on focus; a `SIGNED_OUT` event routes to `/`. Keep that. `profileFromCachedSession` is only a short-lived fallback when Supabase is unreachable.
4. **Cold launch always lands on sign-in.** An existing session is deliberately never used to auto-skip to the dashboard.
5. **"Remember me" ≠ "Keep me signed in".** Remember-me only pre-fills the form (never persists a raw password beyond that); keep-signed-in decides whether the refresh token survives restart. Don't merge them.
6. **reCAPTCHA is a client-side UI gate only.** The token is intentionally *not* passed to Supabase (`captchaToken`), because Supabase only verifies hCaptcha/Turnstile. Don't describe it as a security boundary; real enforcement needs a provider switch or Edge Functions.
7. **Reuse before adding.** Take styles from `lib/formStyles.ts`, colours from `useTheme()` in `lib/theme.tsx`; don't hard-code hex colours in screens. Type props and Supabase results; avoid `any`.
8. **Install packages with `npx expo install <pkg>`** so versions match SDK 57.
9. **Touch only the files the request needs.** No reformatting or refactors of unrelated code.

## Testing

No test suite exists. After changes: run `npm run lint` and fix what you introduced, then check the affected flow with `npm run web` (sign in, sign up, reset, edit profile as relevant). If you couldn't run the app, say so.

## Security and environment

`.env` (git-ignored; never commit or print values) uses: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_RECAPTCHA_SITE_KEY`, `EXPO_PUBLIC_APP_BASE_URL`, and optional overrides `EXPO_PUBLIC_SIGNUP_REDIRECT_URL`, `EXPO_PUBLIC_RESET_REDIRECT_URL`, `EXPO_PUBLIC_RECAPTCHA_BASE_URL`, `EXPO_PUBLIC_RECOVERY_LINK_BLOCK_HOURS`. The file holds several commented domain blocks (Firebase / own domain / localhost); exactly one block should be active.

- Only the public anon key belongs in client code. Real protection is Row Level Security and Storage policies.
- Supabase Auth → URL Configuration must list the reset/signup redirect URLs (including `vcode://reset-password`).
- The `avatars` bucket is private; the app reads avatars through signed URLs (1 h).
- After password reset the app calls the Supabase Edge Function `send-password-change-success-email` (body `{ "email": "..." }`); the function is not in this repo.
- Static web export: do **not** enable SPA rewrites on the host, they collapse every route to the index page.

## Commits and PRs

- Don't commit or push unless asked.
- Commit subjects are imperative and under 72 characters (e.g. "Fix reset-password redirect on web"). Run `npm run lint` before committing.
- Never commit `.env` or any file containing keys.
