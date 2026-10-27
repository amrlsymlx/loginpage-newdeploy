@AGENTS.md

## Claude Code notes

- Before touching auth flows, read `README.md` ("Flow" and "Key design decisions"); it documents why sign-in, verification links and sessions behave as they do.
- This repo is the SDK 57 / Vercel sibling of `../appwithsupabase` (SDK 54 / Firebase). Fixes to shared auth logic (`lib/authStorage.ts`, `lib/profile.ts`, `app/index.tsx`, `app/dashboard/*`) usually apply to both; mention it instead of silently editing the other repo.
- `.mcp.json` registers the `lance` MCP server (App Store Connect operator). It's unrelated to day-to-day app changes; don't call it unless asked.
- After edits, run `npm run lint`. There are no tests, so for UI changes verify with `npm run web` rather than claiming it works.
- Never read out or echo `.env` contents.
