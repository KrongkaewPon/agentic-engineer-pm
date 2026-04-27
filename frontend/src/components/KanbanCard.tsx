import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="pr-7">
        <h4 className="font-display text-sm font-semibold leading-5 text-[var(--navy-dark)]">
          {card.title}
        </h4>
        {card.details && card.details !== "No details yet." ? (
          <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)]">
            {card.details}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(card.id)}
        className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-[var(--gray-text)] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
        aria-label={`Delete ${card.title}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
        </svg>
      </button>
    </article>
  );
};
