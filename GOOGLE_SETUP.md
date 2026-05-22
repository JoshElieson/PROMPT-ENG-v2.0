# Google sign-in setup

FORGE uses Google OAuth 2.0 with **PKCE** and a local browser redirect (desktop) or `http://localhost:1420/oauth/google/callback` (Vite dev).

## 1. Create Google OAuth credentials

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create a project (or pick an existing one).
3. **Create credentials** → **OAuth client ID**.
4. Application type:
   - **Desktop app** (recommended for `npm run tauri:dev`) — no client secret required.
   - **Web application** — also set `VITE_GOOGLE_CLIENT_SECRET` in `.env`.
5. Copy the **Client ID** (and **Client secret** for Web application clients).

## 2. Authorized redirect URIs

Add these redirect URIs on the OAuth client (or use the Desktop app defaults):

| Environment | Redirect URI |
|-------------|----------------|
| Tauri desktop | `http://127.0.0.1` (Google accepts any port on 127.0.0.1 for desktop clients) |
| Vite dev (`npm run dev`) | `http://localhost:1420/oauth/google/callback` |

## 3. Configure the app

In the project root `.env`:

```env
VITE_GOOGLE_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
# Web application clients only:
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-your_secret_here
```

Restart the dev server after changing `.env`.

## 4. Sign in

1. Click the **profile** button in the activity bar.
2. Choose **Sign in with Google**.
3. Approve access in the browser — Forge completes sign-in when you return.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| “Add VITE_GOOGLE_CLIENT_ID to .env” | Set the client ID in `.env` and restart. |
| `redirect_uri_mismatch` | Add the redirect URI from the table above to your Google OAuth client. |
| `client_secret is missing` | Add `VITE_GOOGLE_CLIENT_SECRET` for Web application OAuth clients, then restart. |
| Sign-in times out | Finish approval in the browser within ~5 minutes. |
| Google option disabled | `VITE_GOOGLE_CLIENT_ID` is missing or empty. |

Sessions are stored locally (same store as GitHub sign-in) under `prompt:auth:v1`.
