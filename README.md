# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment variables

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

   `EXPO_PUBLIC_*` values are inlined at build time, so restart with
   `npx expo start --clear` after changing any of them.

3. Start the app

   ```bash
   npx expo start
   ```

## Bot protection (Google reCAPTCHA v2)

Sign-up and "forgot password" show a reCAPTCHA v2 "I'm not a robot" checkbox,
implemented once in [components/Captcha.tsx](components/Captcha.tsx) —
`react-google-recaptcha` on web, and Google's `api.js` inside a WebView on
native.

### Setup

1. Register a **reCAPTCHA v2 ("I'm not a robot" checkbox)** site at
   [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin).
2. Add every hostname the app runs on to the site's domain list: your deployed
   domain, `localhost` for local web development, and the host in
   `EXPO_PUBLIC_RECAPTCHA_BASE_URL` (native runs the challenge in a WebView and
   reCAPTCHA validates the page origin).
3. Put the **site key** in `EXPO_PUBLIC_RECAPTCHA_SITE_KEY`.

There is no secret key to configure — see below for why.

### This is a client-side gate only

> **The challenge is not verified by any server.** It gates the submit button,
> which stops casual abuse through the UI, but a script calling Supabase
> directly with the anon key bypasses it entirely.

The token is deliberately **not** passed to Supabase as `options.captchaToken`:
Supabase Auth verifies only hCaptcha and Cloudflare Turnstile, so sending it
would make every sign-up and reset request fail the moment captcha protection
is turned on in the dashboard.

If you need the challenge actually enforced, either:

- **switch provider** to Turnstile or hCaptcha, pass the token as
  `options.captchaToken`, and enable it under **Authentication → Settings → Bot
  and Abuse Protection** with the matching secret key; or
- **move the operations behind Edge Functions** that verify the reCAPTCHA token
  against Google's `siteverify` endpoint and then perform the sign-up / reset
  with the service-role key, with public sign-ups disabled in Supabase. A
  function that only pre-checks the token is not enough — the public endpoints
  stay callable.

## Build for the web

Export a static web build into `dist/`:

```bash
npm run build:web
```

The app exports static route files (one HTML file per route), so serve `dist/`
with any static host. Do **not** enable SPA rewrites — they would collapse every
route onto the index page.

## Supabase Storage setup for avatars

Profile avatars are uploaded to a Supabase Storage bucket named `avatars`.

Follow the steps in [docs/supabase-storage-setup.md](docs/supabase-storage-setup.md) to create the bucket and enable the required policies.

## Supabase password reset setup

To make **Forgot password** work correctly:

1. In Supabase Dashboard, go to **Authentication → URL Configuration**.
2. Add this redirect URL for your app scheme:

   ```text
   vcode://reset-password
   ```

3. In **Authentication → Email Templates → Reset Password**, keep the default `{{ .ConfirmationURL }}` link in the template.

After this, when a user taps **Forgot password** and enters their email, Supabase sends a reset email if the account exists.

### Password-changed success email

The app also calls this Supabase Edge Function after password reset succeeds:

```text
send-password-change-success-email
```

Create and deploy that function to send your custom "password changed successfully" email, and accept:

```json
{
  "email": "user@example.com"
}
```

## Staying signed in

"Keep me signed in" controls where the Supabase refresh token is stored:
persistently (SecureStore on native, `localStorage` on web) when checked, and
in memory only when unchecked. Passwords are never stored on the device.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
