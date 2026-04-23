import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthKanbanApp } from "@/components/AuthKanbanApp";
import { initialData } from "@/lib/kanban";

const signIn = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText(/username/i), username);
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("AuthKanbanApp", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const createStorageMock = () => {
    const store = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(() => {
        store.clear();
      }),
    };
  };

  beforeEach(() => {
    const storage = createStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true,
    });
    window.localStorage.clear();
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/board/") && (!init || init.method === "GET")) {
          return new Response(JSON.stringify(initialData), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/board/") && init?.method === "PUT") {
          return new Response(init.body?.toString() ?? "{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/chat")) {
          return new Response(
            JSON.stringify({
              answer: "Done. I updated your board.",
              model: "openai/gpt-oss-120b",
              provider: "openrouter",
              board_update_applied: true,
              board_update: initialData,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        return new Response("{}", { status: 200 });
      });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("requires login before showing the board", () => {
    render(<AuthKanbanApp />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Kanban Studio" })
    ).not.toBeInTheDocument();
  });

  it("signs in with demo credentials and allows logout", async () => {
    render(<AuthKanbanApp />);

    await signIn("user", "password");
    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    render(<AuthKanbanApp />);

    await signIn("wrong", "creds");
    expect(
      screen.getByText("Invalid credentials. Use user / password.")
    ).toBeInTheDocument();
  });

  it("supports AI chat and refresh trigger", async () => {
    render(<AuthKanbanApp />);
    await signIn("user", "password");

    await userEvent.type(
      await screen.findByPlaceholderText(
        "Ask AI to summarize progress or move cards..."
      ),
      "Please summarize board"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Done. I updated your board.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
