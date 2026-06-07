"use client";

import { useShortlist, type ShortlistItem } from "@/lib/shortlist/context";

interface ShortlistButtonProps {
  item: ShortlistItem;
  className?: string;
  size?: "sm" | "md";
  /** When true, renders as a full-width pill CTA instead of an icon button. */
  pill?: boolean;
}

export function ShortlistButton({ item, className = "", size = "sm", pill = false }: ShortlistButtonProps) {
  const { has, toggle, items } = useShortlist();
  const saved = has(item.id);
  const atMax = items.length >= 10;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(item);
  };

  if (pill) {
    return (
      <button
        onClick={handleClick}
        disabled={atMax && !saved}
        aria-label={saved ? `Remove ${item.name} from shortlist` : `Add ${item.name} to shortlist`}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
          saved
            ? "border-teal bg-teal/10 text-teal-deep hover:bg-teal/20"
            : atMax
              ? "border-paper-rule bg-paper text-ink-4 cursor-not-allowed"
              : "border-paper-rule bg-paper text-ink-2 hover:border-teal hover:text-teal-deep"
        } ${className}`}
      >
        <BookmarkIcon filled={saved} size={size} />
        <span>{saved ? "Saved to shortlist" : atMax ? "Shortlist full (10)" : "Save to shortlist"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={atMax && !saved}
      aria-label={saved ? `Remove from shortlist` : `Add to shortlist`}
      title={saved ? "Remove from shortlist" : atMax ? "Shortlist full (max 10)" : "Save to shortlist"}
      className={`flex items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
        size === "md" ? "h-9 w-9 border" : "h-7 w-7 border"
      } ${
        saved
          ? "border-teal/30 bg-teal/10 text-teal-deep hover:bg-teal/20"
          : atMax
            ? "border-paper-rule bg-paper text-ink-4 cursor-not-allowed"
            : "border-paper-rule bg-white/80 text-ink-3 hover:border-teal/40 hover:text-teal-deep"
      } ${className}`}
    >
      <BookmarkIcon filled={saved} size={size} />
    </button>
  );
}

function BookmarkIcon({ filled, size }: { filled: boolean; size: "sm" | "md" }) {
  const s = size === "md" ? 18 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5Z" />
    </svg>
  );
}
