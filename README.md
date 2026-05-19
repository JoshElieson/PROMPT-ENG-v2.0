# Prompt

A desktop prompt-engineering IDE — connect multiple AI models, manage project context with a file explorer, and orchestrate multi-model "Round Table" conversations.

## Stack

- **Tauri 2** — native desktop shell (downloadable `.exe` / `.dmg` / `.AppImage`)
- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** + **Radix UI** primitives (shadcn-style components)
- **Rust** backend (SQLite, APIs) — coming in later phases

## UI layout (current)

| Region | Purpose |
|--------|---------|
| Activity bar | Provider shortcuts, settings, profile |
| Left sidebar | Chats, projects, file tree with context checkboxes |
| Center | Welcome screen, chat history, prompt input |
| Right sidebar | Round Table weights, streaming response, metrics |
| Status bar | Command hints, system status |

## Prerequisites

1. [Node.js](https://nodejs.org/) (v18+)
2. [Rust](https://www.rust-lang.org/tools/install) — required for `npm run tauri dev` / `npm run tauri build`
3. [Tauri prerequisites](https://tauri.app/start/prerequisites/) for Windows

## Development

Preview the UI in the browser (no Rust needed):

```bash
npm install
npm run dev
```

Open http://localhost:1420

Full desktop app (requires Rust):

```bash
npm run tauri dev
```

## Build installer

```bash
npm run tauri build
```

Installers appear under `src-tauri/target/release/bundle/`.

## Window size

Default **1280×800** (League-client style, not fullscreen). Configured in `src-tauri/tauri.conf.json`.

## Projects & filesystem

- Projects start **empty** — click **+** under Projects to pick a folder from your computer (requires the Tauri desktop app).
- Folders load **lazily** when expanded; hidden/build dirs (`node_modules`, `.git`, etc.) are skipped.
- Per-item permissions (hover a row): **context** checkbox, **R** read, **W** write — persisted in `localStorage`.
- Remove a project with the trash icon on the project root row.

## Next steps

- [ ] Model provider connections (OpenRouter, OpenAI, Anthropic, Gemini, Ollama)
- [ ] SQLite + FTS5 for chat/project storage
- [ ] Wire permissions into AI context injection
- [ ] Round Table orchestration (multi-model synthesis)
- [ ] Keyboard shortcuts (⌘1–4, /, @)
