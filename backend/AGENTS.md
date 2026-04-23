Backend service for the Project Management MVP.

Current scope in Part 9:
- FastAPI app entrypoint in `backend/app.py`
- Static frontend export served at `/` from `backend/static/`
- API test endpoint at `/api/hello`
- Board APIs at `/api/board/{username}` (read + full JSON update)
- Chat API at `/api/chat` with structured output (`response` + optional `board_update`)
- SQLite persistence in `backend/pm.db` with auto-create behavior
- Python project config in `backend/pyproject.toml` using uv

Guidelines:
- Keep backend changes simple and incremental by project part.
- Prefer explicit API routes under `/api/*`.
- Add tests under `backend/tests/` for all new backend behavior.