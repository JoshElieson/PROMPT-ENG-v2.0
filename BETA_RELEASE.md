# FORGE beta release playbook

Ship FORGE to beta users **without** asking them for API keys. Your keys live on a small hosted **managed backend**; the desktop installer connects to it automatically.

## Architecture

```mermaid
flowchart LR
  User[Beta user PC] -->|HTTPS + BACKEND_CLIENT_TOKEN| API[Managed backend]
  API --> OpenAI
  API --> Anthropic
  API --> Gemini
  API --> DeepSeek
  API --> xAI
```

- **Server:** `backend/` — proxies chat requests; holds `OPENAI_API_KEY`, etc.
- **Desktop:** built with `FORGE_BACKEND_URL` + `FORGE_BACKEND_TOKEN` embedded at compile time (`option_env!` in `src-tauri/src/ai_config.rs`).
- **Users:** install `.msi` / `.exe`; no `.env` required.

> **Security:** The desktop token is embedded in the binary and can be extracted. Use a long random `BACKEND_CLIENT_TOKEN`, rate limits (already on the server), and provider spend caps. Rotate the token if it leaks.

---

## Part 1 — Host the managed backend (your API keys)

### 1. Generate a desktop client token

PowerShell (repo root):

```powershell
powershell -NoProfile -File ./scripts/new-backend-token.ps1
```

Save the output as `BACKEND_CLIENT_TOKEN` (backend) and `FORGE_BACKEND_TOKEN` (installer build). They must match.

### 2. Configure provider keys

On your machine, copy `backend/.env.example` → `backend/.env` (local testing only; **do not commit** `.env`).

Set at minimum the providers you want beta users to use:

| Variable | Purpose |
|----------|---------|
| `BACKEND_CLIENT_TOKEN` | Shared secret with desktop app |
| `OPENAI_API_KEY` | GPT models |
| `ANTHROPIC_API_KEY` | Claude |
| `GEMINI_API_KEY` | Gemini |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `XAI_API_KEY` | Grok |

### 3. Test locally

```bash
cd backend
npm install
npm run start
```

```bash
curl http://localhost:8080/healthz
```

Expect JSON with `ok: true` and which providers are configured.

### 4. Deploy to production

Pick one host (all supported in-repo):

| Host | Config file |
|------|-------------|
| [Render](https://render.com) | `backend/render.yaml` |
| [Fly.io](https://fly.io) | `backend/fly.toml` |
| Docker (Railway, Cloud Run, VPS, etc.) | `backend/Dockerfile` |

**Render (quickest):**

1. New **Web Service** → connect this repo.
2. Set **Root Directory** to `backend`.
3. Build: `npm install` · Start: `npm run start`.
4. Add env vars from `backend/.env.example` (paste real keys in the dashboard).
5. Note the public URL, e.g. `https://forge-api.onrender.com`.

**Fly.io:**

```bash
cd backend
fly launch --no-deploy
fly secrets set BACKEND_CLIENT_TOKEN=... OPENAI_API_KEY=... # etc.
fly deploy
```

**Docker:**

```bash
cd backend
docker build -t forge-backend .
docker run -p 8080:8080 --env-file .env forge-backend
```

### 5. Verify production

```bash
curl https://YOUR-BACKEND-URL/healthz
```

You should see `"providers": { "openai": true, "anthropic": true, ... }` for each key you set on Render.

Optional auth check (replace token):

```bash
curl -X POST https://YOUR-BACKEND-URL/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_BACKEND_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"gpt-4o\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}"
```

---

## Part 2 — Build the zero-setup Windows installer

Beta testers should **never** create `.env` files or paste API keys. You configure everything once when **you** build the installer.

On a Windows machine with [Rust](https://rustup.rs/), [Node 18+](https://nodejs.org/), and [Tauri prerequisites](https://tauri.app/start/prerequisites/):

```powershell
cd "C:\path\to\PROMPT ENG v2.0"
npm install

$env:FORGE_BACKEND_URL="https://YOUR-BACKEND-URL"
$env:FORGE_BACKEND_TOKEN="same-as-BACKEND_CLIENT_TOKEN"
npm run release:beta
```

(`npm run release:managed` is the same build.)

Output: `release/1.0.0-2/` containing:

- `FORGE_1.0.0-2_x64-setup.exe` (recommended for users)
- `FORGE_1.0.0-2_x64_en-US.msi`
- `SHA256SUMS.txt`
- `BETA_INSTALL.txt` (user-facing notes)
- `BUILD_INFO.txt` (confirms embedded backend host)

**Important:** Rebuild whenever you change backend URL or token. Do **not** ship `npm run release:local` builds to beta testers (that build expects users to supply their own keys).

Stop `npm run tauri:dev` before a release build. The release script builds the frontend once, then runs Tauri with `src-tauri/tauri.release.conf.json` (skips a second `npm run build` that can flake on Windows with `UV_HANDLE_CLOSING`).

### CI build (optional)

GitHub Actions workflow: `.github/workflows/release-beta.yml`

Repository **Secrets**:

- `FORGE_BACKEND_URL`
- `FORGE_BACKEND_TOKEN`

Run **Actions → Build beta release → Run workflow**, then download artifacts from the run.

---

## Part 3 — Make it downloadable

### Option A — GitHub Releases (recommended)

1. Create a repo (or use existing) on GitHub.
2. Tag: `git tag v1.0.0-2 && git push origin v1.0.0-2` (or upload manually).
3. **Releases → New release** → attach `FORGE_*_x64-setup.exe` and `SHA256SUMS.txt`.
4. Paste release notes from `BETA_INSTALL.txt`.
5. Share the release URL with beta users.

Do **not** commit large `.exe` / `.msi` files to git (see `.gitignore`).

### Option B — Static download page

Template: `docs/beta/index.html`

1. Edit version, download URLs, and checksums.
2. Host on GitHub Pages, Netlify, or Cloudflare Pages pointing at `docs/beta/`.
3. Link users to the page; files can live on GitHub Releases CDN URLs.

### Option C — Direct file share

Upload `release/1.0.0-2/FORGE_1.0.0-2_x64-setup.exe` to Google Drive / Dropbox / S3 and share the link. Include `SHA256SUMS.txt` for verification.

---

## Part 4 — Beta user instructions (copy/paste)

Send something like:

1. Download **FORGE_1.0.0-2_x64-setup.exe** from [your link].
2. (Optional) Verify SHA256 against `SHA256SUMS.txt`.
3. Run the installer. Windows may show SmartScreen for unsigned builds — **More info → Run anyway** until you add code signing.
4. Launch **FORGE**. Sign in with GitHub/Google if you enabled OAuth (see `.env` / `GOOGLE_SETUP.md` for *your* dev keys — separate from AI keys).
5. Chat works immediately — no API key setup.

---

## Part 5 — OAuth for sign-in (optional)

AI keys are handled by the managed backend. **GitHub/Google sign-in** still uses OAuth client IDs in the **frontend build** (`VITE_GITHUB_CLIENT_ID`, `VITE_GOOGLE_*` in root `.env` at build time). For beta:

- Create OAuth apps (GitHub device flow, Google per `GOOGLE_SETUP.md`).
- Set vars before `npm run release:managed`, **or** accept unsigned beta without account features.

---

## Troubleshooting: "builder error" or no AI response

Provider keys on **Render alone are not enough**. The desktop app never reads Render env vars — it only talks to your backend URL.

| Check | What to verify |
|-------|----------------|
| Render service root | **Root Directory** = `backend` (not repo root) |
| Render env vars | `BACKEND_CLIENT_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. (no quotes around values) |
| Desktop → backend link | Installer built with `npm run release:beta` (embeds URL + token). Testers do **not** use `%APPDATA%\FORGE\.env` |
| Token match | `FORGE_BACKEND_TOKEN` (desktop) = `BACKEND_CLIENT_TOKEN` (Render) — exact same string |
| Backend URL | Full public URL from Render dashboard, e.g. `https://forge-api.onrender.com` (must include `.onrender.com` — **not** an internal service ID) |
| Health | `curl https://YOUR-URL/healthz` shows `"ok": true` and providers `true` |

**"builder error"** almost always means the app has a bad backend URL or token (quotes, line breaks, missing `https://`), or the installer was built without `release:managed` and no `%APPDATA%\FORGE\.env`.

---

## Part 6 — Operations checklist

| Task | Action |
|------|--------|
| Rotate leaked desktop token | New `BACKEND_CLIENT_TOKEN` on server + rebuild installer |
| Add a provider | Set key on backend, redeploy server only |
| New app version | Bump `version` in `package.json` + `src-tauri/tauri.conf.json`, rebuild, new GitHub Release |
| Monitor spend | Provider dashboards + backend logs on host |
| Code signing | Buy cert → sign `.exe` / `.msi` to remove SmartScreen warnings |

---

## Quick reference

| Command | Purpose |
|---------|---------|
| `npm run release:beta` | Beta installer — embeds backend URL + token (zero tester setup) |
| `npm run release:local` | Dev build — users supply their own API keys in `.env` |
| `backend` `npm run start` | Run API gateway locally |
| `curl …/healthz` | Health + configured providers |

See also: `README.md`, `backend/README.md`.
