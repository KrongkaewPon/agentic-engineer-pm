"use client";

import { FormEvent, useEffect, useState } from "react";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";

const AUTH_STORAGE_KEY = "pm-authenticated-user";
const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";

export const AuthKanbanApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [boardReloadSignal, setBoardReloadSignal] = useState(0);

  useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const isLoggedIn = storedUser === DEMO_USERNAME;
    setIsAuthenticated(isLoggedIn);
    if (isLoggedIn) {
      setUsername(DEMO_USERNAME);
    }
    setIsReady(true);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, DEMO_USERNAME);
      setUsername(DEMO_USERNAME);
      setIsAuthenticated(true);
      setError(null);
      setPassword("");
      return;
    }

    setError("Invalid credentials. Use user / password.");
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setError(null);
  };

  const handleBoardUpdatedByAI = () => {
    setBoardReloadSignal((value) => value + 1);
  };

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[480px] items-center px-6 py-12">
        <section className="w-full rounded-[28px] border border-[var(--stroke)] bg-white/85 p-8 shadow-[var(--shadow)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Project Management MVP
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--gray-text)]">
            Use demo credentials to access your Kanban board.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-[var(--navy-dark)]">
              Username
              <input
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>

            <label className="block text-sm font-medium text-[var(--navy-dark)]">
              Password
              <input
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 outline-none transition focus:border-[var(--primary-blue)]"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error ? (
              <p className="text-sm font-medium text-[var(--secondary-purple)]">{error}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="mx-auto mt-6 flex w-full max-w-[1500px] justify-end px-6">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
        >
          Log out
        </button>
      </div>
      <div className="mx-auto grid w-full max-w-[1900px] grid-cols-1 gap-6 px-6 pb-8 lg:grid-cols-[1fr_360px]">
        <KanbanBoard
          username={username || DEMO_USERNAME}
          reloadSignal={boardReloadSignal}
        />
        <AIChatSidebar
          username={username || DEMO_USERNAME}
          onBoardUpdated={handleBoardUpdatedByAI}
        />
      </div>
    </>
  );
};
