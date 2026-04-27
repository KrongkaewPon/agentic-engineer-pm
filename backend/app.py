import json
import logging
import os
import sqlite3
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DEFAULT_DB_PATH = BASE_DIR / "data" / "pm.db"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-oss-120b"

app = FastAPI(title="Project Management MVP Backend")
app.state.db_path = DEFAULT_DB_PATH


class Card(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=200)
    details: str = Field(max_length=5000)


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class ChatRequest(BaseModel):
    username: str
    message: str
    history: list[dict[str, str]] = Field(default_factory=list, max_length=50)


class ChatResponse(BaseModel):
    answer: str
    model: str
    provider: str
    board_update_applied: bool = False
    board_update: BoardData | None = None


DEFAULT_BOARD = BoardData(
    columns=[
        Column(id="col-backlog", title="Backlog", cardIds=["card-1", "card-2"]),
        Column(id="col-discovery", title="Discovery", cardIds=["card-3"]),
        Column(id="col-progress", title="In Progress", cardIds=["card-4", "card-5"]),
        Column(id="col-review", title="Review", cardIds=["card-6"]),
        Column(id="col-done", title="Done", cardIds=["card-7", "card-8"]),
    ],
    cards={
        "card-1": Card(
            id="card-1",
            title="Align roadmap themes",
            details="Draft quarterly themes with impact statements and metrics.",
        ),
        "card-2": Card(
            id="card-2",
            title="Gather customer signals",
            details="Review support tags, sales notes, and churn feedback.",
        ),
        "card-3": Card(
            id="card-3",
            title="Prototype analytics view",
            details="Sketch initial dashboard layout and key drill-downs.",
        ),
        "card-4": Card(
            id="card-4",
            title="Refine status language",
            details="Standardize column labels and tone across the board.",
        ),
        "card-5": Card(
            id="card-5",
            title="Design card layout",
            details="Add hierarchy and spacing for scanning dense lists.",
        ),
        "card-6": Card(
            id="card-6",
            title="QA micro-interactions",
            details="Verify hover, focus, and loading states.",
        ),
        "card-7": Card(
            id="card-7",
            title="Ship marketing page",
            details="Final copy approved and asset pack delivered.",
        ),
        "card-8": Card(
            id="card-8",
            title="Close onboarding sprint",
            details="Document release notes and share internally.",
        ),
    },
)


def get_db_path() -> Path:
    return Path(app.state.db_path)


def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def ensure_db(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE
        )
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS boards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            board_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    connection.commit()


def get_or_create_user_id(connection: sqlite3.Connection, username: str) -> int:
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if row:
        return int(row["id"])
    cursor = connection.execute("INSERT INTO users (username) VALUES (?)", (username,))
    connection.commit()
    return int(cursor.lastrowid)


def load_or_create_board(connection: sqlite3.Connection, user_id: int) -> BoardData:
    row = connection.execute(
        "SELECT board_json FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    if row:
        return BoardData.model_validate(json.loads(str(row["board_json"])))

    board_json = DEFAULT_BOARD.model_dump_json()
    connection.execute(
        "INSERT INTO boards (user_id, board_json) VALUES (?, ?)", (user_id, board_json)
    )
    connection.commit()
    return DEFAULT_BOARD


def save_board(connection: sqlite3.Connection, user_id: int, board: BoardData) -> None:
    board_json = board.model_dump_json()
    connection.execute(
        """
        INSERT INTO boards (user_id, board_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            board_json = excluded.board_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (user_id, board_json),
    )
    connection.commit()


CHAT_OUTPUT_SCHEMA = {
    "name": "kanban_chat_response",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "response": {"type": "string"},
            "board_update": {
                "anyOf": [
                    {"type": "null"},
                    {
                        "type": "object",
                        "properties": {
                            "columns": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "string"},
                                        "title": {"type": "string"},
                                        "cardIds": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                    },
                                    "required": ["id", "title", "cardIds"],
                                    "additionalProperties": False,
                                },
                            },
                            "cards": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "string"},
                                        "title": {"type": "string"},
                                        "details": {"type": "string"},
                                    },
                                    "required": ["id", "title", "details"],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["columns", "cards"],
                        "additionalProperties": False,
                    },
                ]
            },
        },
        "required": ["response", "board_update"],
        "additionalProperties": False,
    },
}


def call_openrouter_chat(
    *,
    message: str,
    history: list[dict[str, str]],
    board: BoardData,
) -> ChatResponse:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured",
        )

    system_prompt = (
        "You are a Kanban assistant. "
        "Always respond in JSON that matches the provided schema. "
        "Use board_update only when the user explicitly asks to change the board. "
        "If no board change is needed, set board_update to null."
    )

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for item in history:
        role = item.get("role", "").strip().lower()
        content = item.get("content", "").strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append(
        {
            "role": "user",
            "content": (
                "Current board JSON:\n"
                f"{board.model_dump_json()}\n\n"
                "User question:\n"
                f"{message}"
            ),
        }
    )

    try:
        response = httpx.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": messages,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": CHAT_OUTPUT_SCHEMA,
                },
            },
            timeout=45.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("OpenRouter request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="AI service request failed",
        ) from exc

    data = response.json()
    choices = data.get("choices", [])
    if not choices:
        raise HTTPException(status_code=502, detail="OpenRouter returned no choices")

    content = choices[0].get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=502, detail="OpenRouter returned empty content")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502, detail="OpenRouter response was not valid JSON"
        ) from exc

    answer = parsed.get("response")
    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(
            status_code=502, detail="OpenRouter response missing valid response field"
        )

    board_update: BoardData | None = None
    raw_board_update = parsed.get("board_update")
    if raw_board_update is not None:
        try:
            board_update = BoardData.model_validate(raw_board_update)
        except (ValueError, TypeError) as exc:
            logger.error("OpenRouter returned invalid board_update: %s", exc)
            raise HTTPException(
                status_code=502, detail="OpenRouter returned invalid board_update"
            ) from exc

    return ChatResponse(
        answer=answer.strip(),
        model=str(data.get("model", OPENROUTER_MODEL)),
        provider="openrouter",
        board_update=board_update,
    )


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "hello from fastapi"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    username = payload.username.strip()
    message = payload.message.strip()
    if not username:
        raise HTTPException(status_code=400, detail="username cannot be empty")
    if not message:
        raise HTTPException(status_code=400, detail="message cannot be empty")

    connection = get_connection()
    try:
        ensure_db(connection)
        user_id = get_or_create_user_id(connection, username)
        board = load_or_create_board(connection, user_id)
        result = call_openrouter_chat(
            message=message,
            history=payload.history,
            board=board,
        )
        if result.board_update is not None:
            save_board(connection, user_id, result.board_update)
            result.board_update_applied = True
        return result
    finally:
        connection.close()


@app.get("/api/board/{username}", response_model=BoardData)
def get_board(username: str) -> BoardData:
    clean_username = username.strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="username cannot be empty")

    connection = get_connection()
    try:
        ensure_db(connection)
        user_id = get_or_create_user_id(connection, clean_username)
        return load_or_create_board(connection, user_id)
    finally:
        connection.close()


@app.put("/api/board/{username}", response_model=BoardData)
def update_board(username: str, board: BoardData) -> BoardData:
    clean_username = username.strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="username cannot be empty")

    connection = get_connection()
    try:
        ensure_db(connection)
        user_id = get_or_create_user_id(connection, clean_username)
        save_board(connection, user_id, board)
        return board
    finally:
        connection.close()


# Mount frontend static export at root after API routes.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
