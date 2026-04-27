import httpx
from pathlib import Path

from fastapi.testclient import TestClient

from app import app


client = TestClient(app)


def use_test_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "test_pm.db"
    app.state.db_path = db_path
    if db_path.exists():
        db_path.unlink()
    return db_path


def test_root_serves_html() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "<html" in response.text.lower()


def test_hello_api() -> None:
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "hello from fastapi"}


def test_get_board_creates_db_and_returns_default_board(tmp_path: Path) -> None:
    db_path = use_test_db(tmp_path)

    response = client.get("/api/board/user")
    body = response.json()

    assert response.status_code == 200
    assert db_path.exists()
    assert len(body["columns"]) == 5
    assert "card-1" in body["cards"]


def test_put_board_persists_for_user(tmp_path: Path) -> None:
    use_test_db(tmp_path)
    board = client.get("/api/board/user").json()
    board["columns"][0]["title"] = "Updated Backlog"
    board["cards"]["card-1"]["title"] = "Updated Card Title"

    put_response = client.put("/api/board/user", json=board)
    get_response = client.get("/api/board/user")

    assert put_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.json()["columns"][0]["title"] == "Updated Backlog"
    assert get_response.json()["cards"]["card-1"]["title"] == "Updated Card Title"


def test_boards_are_isolated_between_users(tmp_path: Path) -> None:
    use_test_db(tmp_path)
    user_board = client.get("/api/board/user").json()
    user_board["columns"][1]["title"] = "User Discovery"
    client.put("/api/board/user", json=user_board)

    other_board = client.get("/api/board/alice").json()

    assert other_board["columns"][1]["title"] == "Discovery"
    assert other_board["columns"][1]["title"] != "User Discovery"


def test_rejects_blank_username(tmp_path: Path) -> None:
    use_test_db(tmp_path)

    response = client.get("/api/board/%20")

    assert response.status_code == 400
    assert response.json() == {"detail": "username cannot be empty"}


def test_chat_rejects_empty_message(tmp_path: Path) -> None:
    use_test_db(tmp_path)
    response = client.post("/api/chat", json={"username": "user", "message": "   "})
    assert response.status_code == 400
    assert response.json() == {"detail": "message cannot be empty"}


def test_chat_rejects_empty_chat_username(tmp_path: Path) -> None:
    use_test_db(tmp_path)
    response = client.post("/api/chat", json={"username": " ", "message": "2+2"})
    assert response.status_code == 400
    assert response.json() == {"detail": "username cannot be empty"}


def test_chat_requires_api_key(monkeypatch, tmp_path: Path) -> None:
    use_test_db(tmp_path)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    response = client.post("/api/chat", json={"username": "user", "message": "2+2"})
    assert response.status_code == 503
    assert response.json() == {"detail": "OPENROUTER_API_KEY is not configured"}


def test_chat_success_response_and_board_update(monkeypatch, tmp_path: Path) -> None:
    use_test_db(tmp_path)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    captured_payload = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "model": "openai/gpt-oss-120b",
                "choices": [
                    {
                        "message": {
                            "content": (
                                '{"response":"2+2 equals 4",'
                                '"board_update":{"columns":[{"id":"col-backlog","title":"AI Backlog","cardIds":["card-1","card-2"]},{"id":"col-discovery","title":"Discovery","cardIds":["card-3"]},{"id":"col-progress","title":"In Progress","cardIds":["card-4","card-5"]},{"id":"col-review","title":"Review","cardIds":["card-6"]},{"id":"col-done","title":"Done","cardIds":["card-7","card-8"]}],"cards":{"card-1":{"id":"card-1","title":"Align roadmap themes","details":"Draft quarterly themes with impact statements and metrics."},"card-2":{"id":"card-2","title":"Gather customer signals","details":"Review support tags, sales notes, and churn feedback."},"card-3":{"id":"card-3","title":"Prototype analytics view","details":"Sketch initial dashboard layout and key drill-downs."},"card-4":{"id":"card-4","title":"Refine status language","details":"Standardize column labels and tone across the board."},"card-5":{"id":"card-5","title":"Design card layout","details":"Add hierarchy and spacing for scanning dense lists."},"card-6":{"id":"card-6","title":"QA micro-interactions","details":"Verify hover, focus, and loading states."},"card-7":{"id":"card-7","title":"Ship marketing page","details":"Final copy approved and asset pack delivered."},"card-8":{"id":"card-8","title":"Close onboarding sprint","details":"Document release notes and share internally."}}}}'
                            )
                        }
                    }
                ],
            }

    def fake_post(*args, **kwargs):
        captured_payload.update(kwargs.get("json", {}))
        return FakeResponse()

    monkeypatch.setattr("app.httpx.post", fake_post)

    response = client.post(
        "/api/chat",
        json={
            "username": "user",
            "message": "2+2",
            "history": [{"role": "assistant", "content": "Prior response"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "openrouter"
    assert "4" in response.json()["answer"]
    assert response.json()["board_update_applied"] is True
    assert response.json()["board_update"]["columns"][0]["title"] == "AI Backlog"

    assert captured_payload["response_format"]["type"] == "json_schema"
    assert captured_payload["messages"][-1]["content"].find("Current board JSON:") != -1
    assert captured_payload["messages"][-1]["content"].find("User question:") != -1
    assert captured_payload["messages"][1] == {
        "role": "assistant",
        "content": "Prior response",
    }

    board = client.get("/api/board/user").json()
    assert board["columns"][0]["title"] == "AI Backlog"


def test_chat_malformed_json_response_returns_502(monkeypatch, tmp_path: Path) -> None:
    use_test_db(tmp_path)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    class FakeBadJsonResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "model": "openai/gpt-oss-120b",
                "choices": [{"message": {"content": "not valid json at all {{{"}}],
            }

    monkeypatch.setattr("app.httpx.post", lambda *a, **kw: FakeBadJsonResponse())

    response = client.post("/api/chat", json={"username": "user", "message": "2+2"})
    assert response.status_code == 502
    assert "valid JSON" in response.json()["detail"]


def test_chat_upstream_failure_returns_502(monkeypatch, tmp_path: Path) -> None:
    use_test_db(tmp_path)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def raise_error(*args, **kwargs):
        raise httpx.HTTPError("upstream failure")

    monkeypatch.setattr("app.httpx.post", raise_error)

    response = client.post("/api/chat", json={"username": "user", "message": "2+2"})
    assert response.status_code == 502
    assert response.json()["detail"] == "AI service request failed"
