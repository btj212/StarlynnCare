"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTransition } from "react";

interface SmallHomesToggleProps {
  hiddenCount: number;
}

/**
 * Flips the ?show=small search param to reveal / hide ≤6-bed
 * board-and-care homes on the city/county listing page.
 *
 * Uses Link-style URL mutation (router.push) so the toggle is
 * a standard navigation — no client-side filter, the server
 * re-runs the query with the new param.
 */
export function SmallHomesToggle({ hiddenCount }: SmallHomesToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const showSmall = searchParams.get("show") === "small";

  function handleToggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (showSmall) {
      params.delete("show");
    } else {
      params.set("show", "small");
    }
    const query = params.toString();
    startTransition(() => {
      router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    });
  }

  if (hiddenCount === 0 && !showSmall) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        showSmall
          ? "border-navy/30 bg-navy/5 text-navy hover:bg-navy/10"
          : "border-sc-border bg-white text-slate hover:border-teal/40 hover:text-teal"
      } disabled:opacity-60`}
    >
      {showSmall ? (
        <>
          <span aria-hidden>✕</span>
          Hide small care homes (≤6 beds)
        </>
      ) : (
        <>
          <span aria-hidden>+</span>
          Show small care homes (≤6 beds)
          {hiddenCount > 0 && (
            <span className="ml-0.5 tabular-nums text-muted">
              ({hiddenCount})
            </span>
          )}
        </>
      )}
    </button>
  );
}
