# Frontend Overview

This folder contains the existing Next.js frontend demo for the MVP Kanban UI.

Current behavior:
- `src/app/page.tsx` renders `AuthKanbanApp` as the home experience.
- `src/components/KanbanBoard.tsx` manages in-memory board state on the client.
- `src/components/AuthKanbanApp.tsx` gates access with demo credentials and provides logout.
- `KanbanBoard` reads/writes board state via backend APIs when a username is available.
- `src/components/AIChatSidebar.tsx` provides sidebar AI chat via `POST /api/chat`.
- Users can rename columns, add/delete cards, and drag cards between columns.
- Styling follows the project color scheme through CSS variables and utility classes.

Current boundaries:
- Authentication is frontend-only using demo credentials (`user` / `password`).
- Login state is local-only and not backed by server sessions.
- Kanban persistence depends on backend API availability; local fallback is used when API is unavailable.
- AI chat is available, but advanced conversation controls and rich message formatting are not implemented yet.

Testing:
- Unit/component tests use Vitest (`npm run test:unit`).
- End-to-end tests use Playwright (`npm run test:e2e`).
