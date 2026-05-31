# FORGE Managed Backend

Hosted API gateway for FORGE desktop installers.

## What it does

- Keeps provider API keys on the server.
- Exposes provider-compatible endpoints used by the desktop app:
  - `POST /openai/v1/chat/completions`
  - `POST /anthropic/v1/messages`
  - `POST /gemini/v1beta/models/:modelAction`
  - `POST /deepseek/v1/chat/completions`
  - `POST /xai/v1/chat/completions`
- Protects access with a shared desktop token (`BACKEND_CLIENT_TOKEN`).
- Applies basic request-rate limiting.

## Local run

```bash
cd backend
npm install
cp .env.example .env
```

Set:

- `BACKEND_CLIENT_TOKEN` (required)
- Any provider keys you want enabled (`OPENAI_API_KEY`, etc.)

Then:

```bash
npm run start
```

Health check:

```bash
curl http://localhost:8080/healthz
```

Response includes `providers` (which API keys are configured on the server) and `authRequired` (whether `BACKEND_CLIENT_TOKEN` is set).

## Deploy

| Platform | Files |
|----------|-------|
| Render | `render.yaml` (root dir: `backend`) |
| Fly.io | `fly.toml` + `Dockerfile` |
| Any container host | `Dockerfile` |

- Start command: `npm run start`
- Build command: `npm install`
- Port: `8080` (or set `PORT`)

Set environment variables from `.env.example` in your host dashboard.

Full beta playbook: [../BETA_RELEASE.md](../BETA_RELEASE.md).

## Build a zero-setup installer

From the repo root:

```powershell
$env:FORGE_BACKEND_URL="https://your-backend.example.com"
$env:FORGE_BACKEND_TOKEN="same-as-BACKEND_CLIENT_TOKEN"
npm run release:managed
```

This embeds backend connection defaults in the binary so end users do not need to edit any files.
