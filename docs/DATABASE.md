# Database approach (Part 5)

## Goal

Use SQLite for local persistence with one board per user, while storing the Kanban payload as JSON to keep MVP implementation simple.

## Proposed schema

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
);

CREATE TABLE boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    board_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Why this schema

- Supports future multi-user expansion now (`users` table).
- Enforces one board per user in MVP (`boards.user_id` is `UNIQUE`).
- Stores Kanban as JSON for fast iteration without over-modeling cards/columns tables.
- Keeps update/read operations straightforward in backend routes.

## JSON structure in `board_json`

The JSON value should follow the frontend board shape:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Example task",
      "details": "Example details"
    }
  }
}
```

## MVP data rules

- Username is the lookup key for a user's board.
- If a user has no board yet, backend creates a default board snapshot.
- Board updates replace the stored JSON document for that user.
- SQLite file is created automatically if it does not exist.

## Trade-offs

- Pros: very simple, fast to ship, minimal migration complexity for MVP.
- Cons: limited queryability over individual cards/columns inside JSON.

## Future migration path (post-MVP)

If query complexity grows, split into normalized tables:
- `boards`
- `columns`
- `cards`
- `column_cards` (ordering)

Keep `board_json` as optional cache/snapshot during migration.
