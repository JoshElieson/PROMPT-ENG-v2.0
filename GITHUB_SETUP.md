# GitHub sign-in setup

Prompt uses GitHub’s **device flow** so you can sign in from the desktop app without a backend or client secret.

## 1. Create a GitHub OAuth app

1. Open [New OAuth App](https://github.com/settings/applications/new).
2. Set **Application name** (e.g. `Prompt local`).
3. **Homepage URL** can be `http://localhost:1420` (used for local dev).
4. Leave **Authorization callback URL** empty (not used for device flow).
5. Click **Register application**.

## 2. Enable device flow

1. Open your new app under [Developer settings → OAuth Apps](https://github.com/settings/developers).
2. Enable **Device Authorization Flow** (required).
3. Copy the **Client ID** (not the client secret).

## 3. Configure the app

In the project root, edit `.env`:

```env
VITE_GITHUB_CLIENT_ID=Ov23liYourClientIdHere
```

Restart the dev server after changing `.env`:

```bash
npm run tauri:dev
```

## 4. Sign in

1. Click the **profile** button in the activity bar.
2. Choose **Sign in with GitHub**.
3. Enter the code shown in the menu on GitHub (or use **Open GitHub**).
4. Approve access — the app completes sign-in automatically.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| “Add VITE_GITHUB_CLIENT_ID to .env” | Create `.env` from `.env.example` and set your Client ID. Restart dev. |
| “GitHub request failed” / network errors | Run via `npm run tauri:dev` (recommended). Browser-only `npm run dev` uses a dev proxy and is secondary. |
| “Sign-in timed out” | Complete authorization on GitHub before the code expires (~15 minutes). |
| “GitHub sign-in was denied” | Approve the app on the device authorization page. |

OAuth tokens are stored locally in `localStorage` under `prompt:auth:v1`.
