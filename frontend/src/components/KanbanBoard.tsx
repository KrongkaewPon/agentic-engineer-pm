"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, initialData, moveCard, type BoardData, type Card } from "@/lib/kanban";

type KanbanBoardProps = {
  username?: string;
  reloadSignal?: number;
};

const buildBoardApiUrl = (username: string) =>
  `/api/board/${encodeURIComponent(username)}`;

export const KanbanBoard = ({ username, reloadSignal = 0 }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoadingBoard, setIsLoadingBoard] = useState(Boolean(username));
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isHydratedFromApi, setIsHydratedFromApi] = useState(!username);
  const skipNextSaveRef = useRef(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = board.cards;

  useEffect(() => {
    if (!username) {
      setIsHydratedFromApi(true);
      return;
    }

    let isCurrent = true;
    setIsLoadingBoard(true);
    setSyncMessage("Loading board...");

    fetch(buildBoardApiUrl(username))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load board (${response.status})`);
        }
        const data = (await response.json()) as BoardData;
        if (!isCurrent) {
          return;
        }
        setBoard(data);
        setSyncMessage(null);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }
        setSyncMessage("Working offline. Changes sync when API is available.");
      })
      .finally(() => {
        if (!isCurrent) {
          return;
        }
        setIsLoadingBoard(false);
        setIsHydratedFromApi(true);
        skipNextSaveRef.current = true;
      });

    return () => {
      isCurrent = false;
    };
  }, [reloadSignal, username]);

  useEffect(() => {
    if (!username || !isHydratedFromApi) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    let isCurrent = true;
    setIsSavingBoard(true);
    setSyncMessage("Saving...");

    fetch(buildBoardApiUrl(username), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(board),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to save board (${response.status})`);
        }
        await response.json();
        if (!isCurrent) {
          return;
        }
        setSyncMessage("Saved");
        window.setTimeout(() => {
          if (isCurrent) {
            setSyncMessage(null);
          }
        }, 1200);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }
        setSyncMessage("Save failed. Retry on next change.");
      })
      .finally(() => {
        if (isCurrent) {
          setIsSavingBoard(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [board, isHydratedFromApi, username]);

  const handleDragStart = (event: DragStartEvent) => {
    if (typeof event.active.id !== "string") return;
    setActiveCardId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = active.id;
    const overId = over.id;
    if (typeof activeId !== "string" || typeof overId !== "string") {
      return;
    }

    setBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, activeId, overId),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
              {syncMessage ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gray-text)]">
                  {syncMessage}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        {isLoadingBoard ? (
          <div className="rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm text-[var(--gray-text)]">
            Loading board...
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-6 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds
                  .map((cardId) => board.cards[cardId])
                  .filter((card): card is Card => card !== undefined)}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        {isSavingBoard ? (
          <p className="text-right text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gray-text)]">
            Syncing...
          </p>
        ) : null}
      </main>
    </div>
  );
};
