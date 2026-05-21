# Agent instructions (Forge)

All agents working in this repository must follow **`FORGE_ENGINEERING_GUIDE.md`** and existing repo conventions **before** generating or modifying code.

## Required first step

1. Read `FORGE_ENGINEERING_GUIDE.md` (architecture, state, components, styling, async/AI patterns).
2. Read surrounding code in the target feature and mirror its patterns (`@/` imports, contexts, hooks, types).

## Repository map

| Area | Location |
|------|----------|
| React UI | `src/components/`, `src/App.tsx` |
| Shared logic | `src/lib/`, `src/hooks/` |
| App state | `src/contexts/` |
| Types | `src/types/` |
| Static data | `src/data/` |
| Desktop / AI backend | `src-tauri/`, `backend/` |

## Commands

```bash
npm run dev          # frontend only
npm run tauri:dev    # full desktop app
npm run lint         # ESLint (src + backend)
npm run lint:fix     # ESLint with safe autofixes
npm run build        # tsc + vite build (use to verify TS/React changes)
```

## Principles (summary)

- Modular, agent-first architecture — avoid giant files and duplicated logic.
- Preserve UX and behavior unless explicitly asked to change them.
- Prefer incremental, low-risk refactors over rewrites.

See `.cursor/rules/forge-engineering-guide.mdc` for the always-on Cursor rule.
