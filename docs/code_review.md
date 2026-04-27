# Code Review

Reviewed against the full codebase as of the initial commit. All file references are from the repo root.

---

## Summary

The MVP is clean and well-scoped. The core logic is correct, tests pass, and the architecture is sensible for a local-only single-user app. The issues below are mostly about missing guards, a few real bugs, and infrastructure gaps that matter once this moves beyond localhost.

Severity scale: **HIGH** (bug or data-loss risk), **MEDIUM** (correctness/quality gap), **LOW** (improvement).

---

## Backend — `backend/app.py`

### HIGH: Raw exception message leaked to client
**Line 294–297**
```python
raise HTTPException(
    status_code=502,
    detail=f"OpenRouter request failed: {exc}",
)
```
`httpx.HTTPError` can include request headers (which carry the API key) in its string representation depending on version. Replace with a static message:
```python
raise HTTPException(status_code=502, detail="AI service request failed") from exc
```

### HIGH: SQLite database not persisted across container rebuilds
The database is written to `/app/backend/pm.db` inside the container. A `docker compose up --build` recreates the image and wipes all board data. The docker-compose.yml has no volume mount. Add to `docker-compose.yml`:
```yaml
volumes:
  - ./data:/app/backend/data
```
And update `DEFAULT_DB_PATH` in `app.py` to `BASE_DIR / "data" / "pm.db"`.

### MEDIUM: `except Exception` too broad
**Line 326**
```python
except Exception as exc:
    raise HTTPException(status_code=502, detail="OpenRouter returned invalid board_update") from exc
```
Masks programming errors (AttributeError, etc.) that should surface. Narrow to:
```python
except (ValueError, TypeError) as exc:
```
Pydantic raises `ValidationError` (subclass of `ValueError`) for invalid data.

### MEDIUM: No length validation on `history` or card fields
**Lines 39–42, 22–25**
`ChatRequest.history` has no length limit. A client can send thousands of history entries, inflating the prompt and memory usage. Card `title` and `details` have no max-length constraints. Add `Field` constraints:
```python
history: list[dict[str, str]] = Field(default_factory=list, max_length=50)
# And:
title: str = Field(..., min_length=1, max_length=200)
details: str = Field(default_factory=str, max_length=5000)
```

### MEDIUM: No index on `users.username`
**Lines 121–126 in `ensure_db`**
Every board request runs `SELECT id FROM users WHERE username = ?` with no index. Currently only one user exists, but an index is the right call:
```sql
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
```
Add this to `ensure_db` after the table definitions.

### MEDIUM: No logging
There is no structured logging anywhere. Failures are invisible in production. Add at minimum:
```python
import logging
logger = logging.getLogger(__name__)
```
And log errors (e.g., in the `except` blocks) before raising `HTTPException`.

### LOW: Magic number timeout
**Line 290**
```python
timeout=45.0,
```
Move to a named constant at the top of the file:
```python
OPENROUTER_TIMEOUT_SECONDS = 45.0
```

---

## Frontend

### MEDIUM: `useMemo` on line 41 does nothing
**`frontend/src/components/KanbanBoard.tsx` line 41**
```typescript
const cardsById = useMemo(() => board.cards, [board.cards]);
```
This is just an alias — `board.cards` is already a stable object reference. The memo never prevents recomputation because the function body just returns the dependency. Remove the memo and use `board.cards` directly.

### MEDIUM: `board.cards[cardId]` can be `undefined` at render time
**`frontend/src/components/KanbanBoard.tsx` line 264**
```typescript
cards={column.cardIds.map((cardId) => board.cards[cardId])}
```
If `cardIds` references an ID that doesn't exist in `cards` (e.g., after a failed partial board update from AI), this passes `undefined` to `KanbanColumn`/`KanbanCard` and causes a runtime crash. Filter orphaned IDs:
```typescript
cards={column.cardIds
  .map((cardId) => board.cards[cardId])
  .filter((card): card is Card => card !== undefined)
}
```

### MEDIUM: `active.id as string` cast without check
**Lines 137, 150**
```typescript
setActiveCardId(event.active.id as string);
// ...
columns: moveCard(prev.columns, active.id as string, over.id as string),
```
dnd-kit's `UniqueIdentifier` is `string | number`. The `as string` cast is unsafe. Add a runtime guard:
```typescript
if (typeof active.id !== "string" || typeof over.id !== "string") return;
```

### MEDIUM: `history` useMemo in `AIChatSidebar` is redundant
**`frontend/src/components/AIChatSidebar.tsx` lines 33–36**
```typescript
const history = useMemo(
  () => messages.map(({ role, content }) => ({ role, content })),
  [messages]
);
```
`messages` changes on every send, so the memo recomputes every time anyway. The mapping also doesn't involve the `id` field since `ChatMessage` has no `id`. Remove the memo and inline the mapping directly in the `fetch` body.

### MEDIUM: `ChatResponse` type in sidebar is missing the `board_update` field
**`frontend/src/components/AIChatSidebar.tsx` lines 10–15**
```typescript
type ChatResponse = {
  answer: string;
  model: string;
  provider: string;
  board_update_applied: boolean;
};
```
The backend also returns `board_update: BoardData | null` (see `app.py` line 50). The frontend type omits this. While the app doesn't use it in the sidebar, the types are drifting from the source of truth. Either add `board_update` to the type or consolidate types to a shared file.

### MEDIUM: Message list key uses index (anti-pattern)
**`frontend/src/components/AIChatSidebar.tsx` line 108**
```typescript
key={`${message.role}-${index}`}
```
React uses keys to track element identity. An index-based key means if a message is removed or inserted mid-list, React will mis-reconcile. Add an `id` field to `ChatMessage`:
```typescript
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
// ...
key={message.id}
```

### MEDIUM: No `maxLength` on chat textarea
**`frontend/src/components/AIChatSidebar.tsx` line 122**
There is no client-side limit on what a user can paste into the chat input. This can bloat the prompt payload. Add:
```typescript
<textarea maxLength={2000} ... />
```

### LOW: Blank flash on auth hydration
**`frontend/src/components/AuthKanbanApp.tsx` line 56–58**
```typescript
if (!isReady) {
  return null;
}
```
Returns nothing while checking localStorage, causing a momentary blank screen. Replace with a minimal placeholder:
```typescript
if (!isReady) {
  return <div className="min-h-screen bg-white" />;
}
```

### LOW: Redundant `|| DEMO_USERNAME` fallback
**`frontend/src/components/AuthKanbanApp.tsx` lines 125, 129**
```typescript
username={username || DEMO_USERNAME}
```
`username` is always set to `DEMO_USERNAME` at authentication time (line 24), so it can never be empty when the board is rendered. Use `username` directly.

---

## Infrastructure

### HIGH: Docker container runs as root
**`Dockerfile`**
No `USER` instruction. The app runs as root inside the container. Any code execution vulnerability gives full container access. Add before `EXPOSE`:
```dockerfile
RUN useradd -m -u 1000 appuser
USER appuser
```

### HIGH: No restart policy
**`docker-compose.yml`**
If the process crashes (e.g., OOM), the container stays down until manually restarted. Add:
```yaml
restart: unless-stopped
```

### MEDIUM: No `HEALTHCHECK` in Dockerfile
Container orchestrators and `docker compose` cannot detect if the app is up but broken (e.g., port bound but returning 500s). Add:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/hello')" || exit 1
```
(Using the stdlib to avoid needing `curl` in the slim image.)

### MEDIUM: No resource limits
**`docker-compose.yml`**
An unconstrained container can consume all host memory. Add:
```yaml
services:
  pm-app:
    mem_limit: 512m
    cpus: "1.0"
```

### LOW: Frontend build does not run `tsc`
**`Dockerfile` line 9** and **`frontend/package.json`**
`npm run build` calls `next build`, which transpiles TypeScript but does not fail on type errors by default. Add a type-check step:
```json
"build": "tsc --noEmit && next build"
```
This ensures the Docker build fails on type errors rather than silently shipping them.

---

## Test Gaps

### Backend (`backend/tests/test_app.py`)
- No test for malformed JSON from OpenRouter (the `json.loads` path at line 309).
- No test for oversized `history` payload once limits are added.
- `test_chat_success_response_and_board_update` doesn't verify the board was actually persisted to the DB after a board update.

### Frontend unit tests (`frontend/src/`)
- No test file for `AIChatSidebar`. The component has meaningful state (sending state, error branch, board-updated branch) with zero unit coverage.
- `moveCard` tests (`lib/kanban.test.ts`) don't cover the case where `active.id` is not found in any column — should return columns unchanged.
- No test for the undefined-card filter once that is added to `KanbanBoard`.

---

## Action List (priority order)

| # | Severity | File | Action |
|---|----------|------|--------|
| 1 | HIGH | `app.py:294` | Remove raw exception from HTTP response detail |
| 2 | HIGH | `docker-compose.yml` | Add volume mount for SQLite persistence |
| 3 | HIGH | `Dockerfile` | Add `USER appuser` (non-root) |
| 4 | HIGH | `docker-compose.yml` | Add `restart: unless-stopped` |
| 5 | MEDIUM | `app.py:326` | Narrow `except Exception` to `except (ValueError, TypeError)` |
| 6 | MEDIUM | `app.py:39` | Add `max_length=50` to `history` field; add field constraints to `Card` |
| 7 | MEDIUM | `app.py` | Add `CREATE INDEX` for `users.username` in `ensure_db` |
| 8 | MEDIUM | `app.py` | Add logging |
| 9 | MEDIUM | `KanbanBoard.tsx:264` | Filter undefined cards before passing to column |
| 10 | MEDIUM | `KanbanBoard.tsx:137,150` | Guard `active.id` / `over.id` as `string` at runtime |
| 11 | MEDIUM | `KanbanBoard.tsx:41` | Remove useless `useMemo` on `board.cards` |
| 12 | MEDIUM | `AIChatSidebar.tsx:33` | Remove useless `useMemo` on `history` |
| 13 | MEDIUM | `AIChatSidebar.tsx:10` | Add `board_update` to `ChatResponse` type |
| 14 | MEDIUM | `AIChatSidebar.tsx:108` | Replace index-based key with message `id` |
| 15 | MEDIUM | `AIChatSidebar.tsx:122` | Add `maxLength={2000}` to textarea |
| 16 | MEDIUM | `Dockerfile` | Add `HEALTHCHECK` |
| 17 | MEDIUM | `docker-compose.yml` | Add resource limits |
| 18 | MEDIUM | `package.json` | Add `tsc --noEmit` to build script |
| 19 | LOW | `app.py:290` | Extract timeout to named constant |
| 20 | LOW | `AuthKanbanApp.tsx:57` | Replace `return null` with placeholder div |
| 21 | LOW | `AuthKanbanApp.tsx:125,129` | Remove redundant `|| DEMO_USERNAME` fallback |
| 22 | LOW | `Dockerfile` | Add `USER appuser` |
| 23 | TEST | `test_app.py` | Add test: malformed OpenRouter JSON response |
| 24 | TEST | `test_app.py` | Add test: board persisted to DB after AI board_update |
| 25 | TEST | Frontend | Add `AIChatSidebar.test.tsx` covering send/error/board-updated paths |
| 26 | TEST | `kanban.test.ts` | Add test: `moveCard` with unknown card ID returns columns unchanged |
