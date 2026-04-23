"use client";

import { FormEvent, useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  answer: string;
  model: string;
  provider: string;
  board_update_applied: boolean;
};

type AIChatSidebarProps = {
  username: string;
  onBoardUpdated: () => void;
};

export const AIChatSidebar = ({ username, onBoardUpdated }: AIChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask me to summarize or update your board.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const history = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) {
      return;
    }

    setInput("");
    setIsSending(true);
    setStatus("Thinking...");
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          message,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed (${response.status})`);
      }

      const body = (await response.json()) as ChatResponse;
      setMessages((prev) => [...prev, { role: "assistant", content: body.answer }]);
      if (body.board_update_applied) {
        setStatus("Board updated");
        onBoardUpdated();
      } else {
        setStatus("Done");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I could not reach the AI service right now. Please try again.",
        },
      ]);
      setStatus("Request failed");
    } finally {
      setIsSending(false);
      window.setTimeout(() => setStatus(null), 1500);
    }
  };

  return (
    <aside className="w-full rounded-[28px] border border-[var(--stroke)] bg-white/90 p-5 shadow-[var(--shadow)] backdrop-blur lg:w-[360px]">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
          AI Assistant
        </h2>
        {status ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            {status}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-[var(--gray-text)]">
        Ask questions or request board changes.
      </p>

      <div className="mt-4 h-[420px] overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === "user"
                  ? "self-end rounded-2xl bg-[var(--secondary-purple)] px-3 py-2 text-sm text-white"
                  : "self-start rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)]"
              }
            >
              {message.content}
            </div>
          ))}
        </div>
      </div>

      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask AI to summarize progress or move cards..."
          className="h-24 w-full resize-none rounded-2xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={isSending}
          className="rounded-xl bg-[var(--secondary-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
};
