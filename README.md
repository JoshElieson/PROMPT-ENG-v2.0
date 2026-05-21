# FORGE

Desktop prompt-engineering IDE — multi-model chat, project file context, and Round Table orchestration.

**Stack:** Tauri 2 · React 19 · TypeScript · Vite · Tailwind v4

---

## Quick start (UI only)

Fastest way to hack on the frontend — no Rust required.

```bash
npm install
npm run dev
```

Open **http://localhost:1420**

| Command | What it does |
|---------|----------------|
| `npm run dev` | Vite dev server (hot reload) |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build locally |

---

## Full desktop app (Tauri)

Use this when you need native dialogs, filesystem access, or the real window shell.

### One-time setup

1. **[Node.js](https://nodejs.org/)** 18+
2. **[Rust](https://www.rust-lang.org/tools/install)** (`rustup` on Windows is fine)
3. **[Tauri Windows prerequisites](https://tauri.app/start/prerequisites/)** (WebView2, MSVC build tools)

```bash
npm install
npm run tauri:dev
```

`tauri:dev` runs a small PowerShell helper that puts Cargo on `PATH` for the session, then starts `tauri dev` (Vite on **1420** + native window).

### If `cargo` is not found

- Close the terminal and open a new one after installing Rust, **or**
- Add `%USERPROFILE%\.cargo\bin` to your user **PATH**, **or**
- On Windows: `winget install Rustlang.Rustup`, then retry in a new terminal

### Build an installer

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`

### Beta website release (v1.0)

Use this to generate upload-ready files in one command:

```bash
npm run release:beta
```

This creates `release/1.0.0-1/` and copies installer artifacts plus `SHA256SUMS.txt` for integrity checks.

---

## Project layout

| Path | Role |
|------|------|
| `src/` | React UI (`@/` alias → `src/`) |
| `src/contexts/` | App-wide React context (chats, projects, layout, git, auth, Round Table) |
| `src/lib/` | Tauri bridges, storage, chat helpers, filesystem utilities |
| `src/types/` | Shared TypeScript types |
| `src-tauri/` | Rust / Tauri config |
| `scripts/tauri-dev.ps1` | Windows-friendly `tauri dev` launcher |

Default window: **1280×800** (`src-tauri/tauri.conf.json`).

---

## Features (current)

- **Activity bar** — providers, settings, profile
- **Left sidebar** — chats, projects, file tree with context checkboxes
- **Center** — welcome, history, prompt input
- **Right sidebar** — Round Table weights, streaming, metrics
- **Projects** — pick a folder (+), lazy tree, per-node **AI access** checkboxes (`localStorage`); needs the Tauri app for folder picker
- **AI chat (Tauri)** — OpenAI, Anthropic, and Gemini with optional **workspace tools** when AI access is enabled on project paths: `read_file`, `write_file`, `list_directory` (scoped to those paths; UTF-8 text only; read cap 512KB per file)

---

## Roadmap

- Model providers (OpenRouter, Ollama, …)
- SQLite + FTS5 for chats/projects
- Streaming responses and richer attachments in prompts
- Keyboard shortcuts (Ctrl+1–4, `/`, `@`)
