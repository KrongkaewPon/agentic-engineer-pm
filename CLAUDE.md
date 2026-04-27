# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Kanban board MVP with a Next.js static frontend served by a FastAPI Python backend, all containerized in Docker. The app runs on port 8000.

## Commands

### Docker (primary dev workflow)
```bash
./scripts/start-mac.sh   # docker compose up --build -d
./scripts/stop-mac.sh    # docker compose down
```
App runs at `http://localhost:8000`

### Frontend (inside `frontend/`)
```bash
npm install
npm run dev           # dev server
npm run build         # static export to out/
npm run test:unit     # Vitest
npm run test:e2e      # Playwright (requires preview server on port 4173)
npm run test:all      # both suites
npm run lint
```

### Backend (inside `backend/`)
```bash
uv run uvicorn app:app --host 0.0.0.0 --port 8000   # run locally
uv run pytest                                         # run tests
uv run pytest tests/test_app.py::test_name           # single test
```

## Architecture

### Request Flow
Browser → FastAPI (`backend/app.py`) → serves static Next.js build at `/`, routes API calls under `/api/*` → SQLite (`backend/pm.db`)

### Frontend (`frontend/src/`)
- `app/page.tsx` renders `AuthKanbanApp` (the auth gate)
- `components/AuthKanbanApp.tsx` — login with hardcoded credentials (`user`/`password`), stores auth in localStorage
- `components/KanbanBoard.tsx` — main board state, debounced API sync, drag-and-drop via `@dnd-kit`
- `components/AIChatSidebar.tsx` — sends chat messages to `POST /api/chat`, auto-reloads board when AI mutates it
- `lib/kanban.ts` — pure business logic (`moveCard`, `createId`, `BoardData` types)

### Backend (`backend/app.py`)
Single-file FastAPI app. Key routes:
- `GET /api/board/{username}` — fetch board, auto-creates user + default board on first access
- `PUT /api/board/{username}` — save full board JSON
- `POST /api/chat` — calls OpenRouter (`openai/gpt-oss-120b`) with structured JSON output; can optionally apply board mutations
- `GET /` — serves static frontend

### Data Model
Board state persisted as a JSON blob in SQLite:
```json
{
  "columns": [{ "id": "col-*", "title": "...", "cardIds": [...] }],
  "cards": { "card-*": { "id": "...", "title": "...", "details": "..." } }
}
```

### AI Integration
`POST /api/chat` uses OpenRouter with JSON Schema structured outputs. The model responds `{ response, board_update }` — if `board_update` is non-null, the backend applies it and `board_update_applied: true` is returned, triggering a frontend board reload. Requires `OPENROUTER_API_KEY` in `.env`.

### Build Pipeline (Dockerfile)
Two-stage build: Node 22 builds the Next.js static export → Python 3.12 runtime installs deps via `uv`, copies the static `out/` into the container, serves everything from FastAPI.

## Key Constraints

- Frontend auth is intentionally frontend-only (no server sessions); credentials are hardcoded for MVP
- One board per user; board stored as a single JSON column (`board_json`) in the `boards` table
- Backend tests use a temp SQLite DB and mock OpenRouter HTTP calls — keep that pattern for new tests
- Color palette: yellow `#ecad0a`, blue `#209dd7`, purple `#753991`, navy `#032147`; fonts: Space Grotesk (display), Manrope (body)


## DEFAULT PLAN

@docs/PLAND.md