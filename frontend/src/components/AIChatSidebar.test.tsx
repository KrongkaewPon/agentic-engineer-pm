import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AIChatSidebar } from "@/components/AIChatSidebar";

const mockFetch = (body: object, ok = true) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  } as unknown as Response);
};

describe("AIChatSidebar", () => {
  it("renders initial assistant message", () => {
    render(<AIChatSidebar username="user" onBoardUpdated={() => {}} />);
    expect(
      screen.getByText("Ask me to summarize or update your board.")
    ).toBeInTheDocument();
  });

  it("sends a message and displays the AI response", async () => {
    mockFetch({
      answer: "Board looks good.",
      model: "m",
      provider: "p",
      board_update_applied: false,
      board_update: null,
    });

    render(<AIChatSidebar username="user" onBoardUpdated={() => {}} />);
    await userEvent.type(
      screen.getByPlaceholderText(/ask ai/i),
      "How is my board?"
    );
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText("How is my board?")).toBeInTheDocument();
      expect(screen.getByText("Board looks good.")).toBeInTheDocument();
    });
  });

  it("shows error message when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    render(<AIChatSidebar username="user" onBoardUpdated={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/ask ai/i), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not reach/i)).toBeInTheDocument();
    });
  });

  it("calls onBoardUpdated when board_update_applied is true", async () => {
    const onBoardUpdated = vi.fn();
    mockFetch({
      answer: "Done.",
      model: "m",
      provider: "p",
      board_update_applied: true,
      board_update: null,
    });

    render(<AIChatSidebar username="user" onBoardUpdated={onBoardUpdated} />);
    await userEvent.type(screen.getByPlaceholderText(/ask ai/i), "Move card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(onBoardUpdated).toHaveBeenCalledTimes(1);
    });
  });

  it("disables send button while request is in flight", async () => {
    let resolve: (v: unknown) => void;
    global.fetch = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    render(<AIChatSidebar username="user" onBoardUpdated={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/ask ai/i), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    resolve!({
      ok: true,
      json: async () => ({ answer: "Hi", model: "m", provider: "p", board_update_applied: false, board_update: null }),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
    });
  });
});
