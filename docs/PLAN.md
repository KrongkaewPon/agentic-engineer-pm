# High level steps for project

Part 1: Plan

Goal: produce an approved, execution-ready plan before any implementation work begins.

Checklist:
- [ ] Review product requirements and technical constraints in `AGENTS.md` and reflect them in this plan.
- [ ] Expand each part (2-10) into concrete implementation substeps that are sequential and non-overlapping.
- [ ] Add explicit tests for each part (unit, integration, and/or smoke tests as appropriate).
- [ ] Add measurable success criteria for each part so completion can be verified objectively.
- [ ] Add `frontend/AGENTS.md` with a concise description of the existing frontend codebase and boundaries.
- [ ] Present updated planning artifacts to the user and request explicit approval before any coding work.

Validation tests for Part 1:
- Scope test: confirm only planning artifacts are modified in this phase (`docs/PLAN.md`, `AGENTS.md`, and `frontend/AGENTS.md`).
- Completeness test: confirm every part (2-10) contains substeps, tests, and success criteria.
- Quality test: confirm checklist items are actionable, concise, and aligned with MVP requirements.
- Approval gate test: confirm user approval is recorded before moving to Part 2.

Success criteria for Part 1:
- The user can review a clear, end-to-end plan with no ambiguous implementation gaps.
- Each part has test expectations and objective completion conditions.
- `frontend/AGENTS.md` exists and accurately describes the current frontend starting point.
- The user explicitly approves the planning artifacts to start implementation.

Handoff gate:
Implementation for Parts 2-10 must not begin until the user explicitly signs off on this revised Part 1 output.

Testing guidance (applies to remaining parts):
- Prioritize valuable tests that cover critical user paths and core behavior.
- Aim for around 80% coverage only when sensible for the change.
- Do not add low-value tests purely to hit a coverage number; below 80% is acceptable when justified.

Part 2: Scaffolding

Set up the Docker infrastructure, the backend in backend/ with FastAPI, and write the start and stop scripts in the scripts/ directory. This should serve example static HTML to confirm that a 'hello world' example works running locally and also make an API call.

Checklist:
- [x] Add Docker build/runtime files (`Dockerfile`, `docker-compose.yml`, `.dockerignore`).
- [x] Scaffold FastAPI backend in `backend/` with a smoke API route.
- [x] Add cross-platform start/stop scripts in `scripts/` (macOS/Linux/Windows).
- [x] Serve a hello-world page and confirm an API call path works.
- [x] Add basic backend smoke tests.

Validation:
- [x] `docker compose up --build -d` succeeds.
- [x] `GET /` and `GET /api/hello` return expected responses.
- [x] Backend tests pass.
- [x] `docker compose down` cleanly stops services.

Success criteria:
- [x] Local Docker run is repeatable.
- [x] Backend scaffold is stable and test-backed.

Part 3: Add in Frontend

Now update so that the frontend is statically built and served, so that the app has the demo Kanban board displayed at /. Comprehensive unit and integration tests.

Checklist:
- [x] Configure frontend static export.
- [x] Update Docker build to include frontend static artifacts in backend image.
- [x] Serve frontend build from FastAPI at `/` while preserving API routes.
- [x] Keep frontend unit and e2e tests passing.

Validation:
- [x] Frontend build succeeds.
- [x] `GET /` renders Kanban UI.
- [x] Frontend unit tests pass.
- [x] Frontend e2e tests pass.

Success criteria:
- [x] Demo Kanban board is available at `/` through backend-served static assets.

Part 4: Add in a fake user sign in experience

Now update so that on first hitting /, you need to log in with dummy credentials ("user", "password") in order to see the Kanban, and you can log out. Comprehensive tests.

Checklist:
- [x] Add frontend-only login gate with credentials `user` / `password`.
- [x] Persist login state locally for current browser session behavior.
- [x] Add logout control that returns user to sign-in screen.
- [x] Update tests for login-required workflow.

Validation:
- [x] Unauthenticated user sees sign-in form first.
- [x] Valid credentials unlock Kanban board.
- [x] Invalid credentials show clear error.
- [x] Logout returns to sign-in view.
- [x] Unit and e2e tests pass.

Success criteria:
- [x] MVP fake sign-in flow is functional and verified.

Part 5: Database modeling

Now propose a database schema for the Kanban, saving it as JSON. Document the database approach in docs/ and get user sign off.
Part 5 output: `docs/DATABASE.md` (schema, JSON shape, constraints, and trade-offs).
Gate: wait for explicit user sign-off on `docs/DATABASE.md` before proceeding with additional backend integration.

Checklist:
- [x] Define SQLite schema supporting multi-user future needs and one board per user for MVP.
- [x] Define JSON structure stored for board payload.
- [x] Document trade-offs and migration path.
- [x] Collect explicit user approval.

Validation:
- [x] Schema, JSON shape, and constraints documented in `docs/DATABASE.md`.
- [x] User sign-off received before moving to Part 6.

Success criteria:
- [x] Database design is documented, reviewable, and approved.

Part 6: Backend

Now add API routes to allow the backend to read and change the Kanban for a given user; test this thoroughly with backend unit tests. The database should be created if it doesn't exist.

Checklist:
- [x] Add board read endpoint (`GET /api/board/{username}`).
- [x] Add board update endpoint (`PUT /api/board/{username}`).
- [x] Implement SQLite auto-create behavior for DB and tables.
- [x] Ensure one-board-per-user persistence and user isolation.
- [x] Add backend unit tests for persistence and validation.

Validation:
- [x] Backend tests pass for create/read/update/user isolation and invalid input.
- [x] Docker runtime checks confirm persistence behavior.

Success criteria:
- [x] Backend APIs can reliably read/write Kanban JSON per user.

Part 7: Frontend + Backend

Now have the frontend actually use the backend API, so that the app is a proper persistent Kanban board. Test very throughly.

Checklist:
- [x] Integrate frontend board load/save with backend API routes.
- [x] Pass authenticated username into board data layer.
- [x] Preserve usable UI behavior when API is temporarily unavailable.
- [x] Update and run unit/e2e/integration tests.

Validation:
- [x] Frontend tests pass after API integration.
- [x] Backend tests remain green.
- [x] Browser-level check confirms board changes persist across reload.

Success criteria:
- [x] Kanban state is persisted through backend API for logged-in user.

Part 8: AI connectivity

Now allow the backend to make an AI call via OpenRouter. Test connectivity with a simple "2+2" test and ensure the AI call is working.

Checklist:
- [x] Add backend AI client for OpenRouter using `OPENROUTER_API_KEY`.
- [x] Add minimal route/service (`POST /api/chat`) to execute a simple prompt (`2+2`) against configured model.
- [x] Add targeted tests with safe mocking for success/failure behavior.
- [x] Add one real connectivity smoke check path for local verification.

Validation:
- [x] Unit tests pass for request construction and response parsing.
- [x] Local smoke check returns expected AI answer format for `2+2`.

Success criteria:
- [x] Backend can successfully call OpenRouter in local environment.

Part 9: Now extend the backend call so that it always calls the AI with the JSON of the Kanban board, plus the user's question (and conversation history). The AI should respond with Structured Outputs that includes the response to the user and optionaly an update to the Kanban. Test thoroughly.

Checklist:
- [x] Define structured output schema for chat reply plus optional board patch/update.
- [x] Build prompt assembly with board JSON + user input + conversation history.
- [x] Parse and validate AI structured output on backend.
- [x] Apply optional board update safely when present.
- [x] Add high-value tests for valid/invalid/partial AI outputs.

Validation:
- [x] Tests cover prompt payload, schema validation, and update application.
- [x] End-to-end backend flow confirms optional board mutation behavior.

Success criteria:
- [x] AI responses are structured and backend-safe, with optional board updates supported.

Part 10: Now add a beautiful sidebar widget to the UI supporting full AI chat, and allowing the LLM (as it determines) to update the Kanban based on its Structured Outputs. If the AI updates the Kanban, then the UI should refresh automatically.

Checklist:
- [x] Add sidebar chat UI with conversation history display.
- [x] Connect frontend chat actions to backend AI endpoint.
- [x] Surface AI response text in chat stream.
- [x] Apply board updates returned by AI and refresh board state automatically.
- [x] Add high-value UI tests for send/receive/update flows.

Validation:
- [x] Manual and automated checks confirm chat interaction and board auto-refresh.
- [x] Regression tests for core board interactions continue to pass.

Success criteria:
- [x] User can chat with AI from sidebar and see board updates reflected automatically.