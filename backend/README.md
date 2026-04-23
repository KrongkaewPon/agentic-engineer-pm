# Backend

This backend uses FastAPI and serves:

- `GET /` for the statically exported frontend
- `GET /api/hello` for a test API response
- `GET /api/board/{username}` to fetch a user's Kanban board (creates default board if missing)
- `PUT /api/board/{username}` to persist a full Kanban board JSON for that user
- `POST /api/chat` to call OpenRouter chat completions (Part 8 connectivity)
  - Request: `{ "username": "user", "message": "...", "history": [{ "role": "user|assistant", "content": "..." }] }`
  - Response: `{ "answer": "...", "model": "...", "provider": "openrouter", "board_update_applied": bool, "board_update": BoardData|null }`

Persistence:
- SQLite database at `backend/pm.db`
- Database and tables are created automatically when first accessed

AI configuration:
- Requires `OPENROUTER_API_KEY` in environment
- Uses model `openai/gpt-oss-120b`

## Local run (without Docker)

```bash
uv run uvicorn app:app --host 0.0.0.0 --port 8000
```
