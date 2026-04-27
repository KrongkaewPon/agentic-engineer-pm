import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

const ACCENT_COLORS = [
  "var(--accent-yellow)",
  "var(--primary-blue)",
  "var(--secondary-purple)",
  "var(--accent-yellow)",
  "var(--primary-blue)",
];

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  colorIndex?: number;
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  colorIndex = 0,
  onRename,
  onAddCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const accentColor = ACCENT_COLORS[colorIndex % ACCENT_COLORS.length];

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="w-full">
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-8 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            {cards.length}
          </span>
        </div>
        <input
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          className="mt-2 w-full bg-transparent font-display text-base font-semibold text-[var(--navy-dark)] outline-none"
          aria-label="Column title"
        />
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-3">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
