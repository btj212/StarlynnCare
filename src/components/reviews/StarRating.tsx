"use client";

import { useState } from "react";
import { STAR_LABELS } from "./categories";

interface StarRatingProps {
  name: string;
  label: string;
  description: string;
  error?: string;
}

export function StarRating({ name, label, description, error }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="mt-0.5 text-xs text-muted leading-snug">{description}</p>
        </div>
        <div
          className="flex shrink-0 items-center gap-0.5"
          onMouseLeave={() => setHovered(0)}
          role="group"
          aria-label={`Rating for ${label}`}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= (hovered || selected);
            return (
              <label
                key={star}
                className="cursor-pointer"
                title={STAR_LABELS[star]}
              >
                <input
                  type="radio"
                  name={name}
                  value={star}
                  className="sr-only"
                  required
                  onChange={() => setSelected(star)}
                  aria-label={`${star} — ${STAR_LABELS[star]}`}
                />
                <svg
                  viewBox="0 0 20 20"
                  className={`h-7 w-7 transition-colors duration-75 ${
                    filled ? "text-amber-400" : "text-sc-border"
                  }`}
                  fill="currentColor"
                  onMouseEnter={() => setHovered(star)}
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </label>
            );
          })}
        </div>
      </div>
      {selected > 0 && (
        <p className="text-right text-[10px] text-muted">{STAR_LABELS[selected]}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
