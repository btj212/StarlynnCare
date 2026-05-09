/**
 * Thumbnails for article previews (homepage §04, mobile editorial strip, /library cards).
 * Keep `alt` identical to article `EditorialHero` usage for accessibility consistency.
 * See `docs/ILLUSTRATION_LIBRARY.md`.
 */
export type ArticleThumbnail = { src: string; alt: string };

const THUMBNAILS: Record<string, ArticleThumbnail> = {
  "/library/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together on the beach — representing the lifestyle and dignity questions families weigh when choosing between memory care and a nursing home",
  },
  "/library/when-is-it-time-for-memory-care": {
    src: "/illustrations/kitchen-conversation-two-women.png",
    alt:
      "Illustrated mother and adult daughter in conversation across a kitchen table — representing the family conversations that precede a memory-care decision",
  },
  "/library/medi-cal-and-memory-care": {
    src: "/illustrations/garden-elderly-man-tending-flowers.png",
    alt:
      "Illustrated older gentleman tending flowers in a garden — representing the daily activities and independence that residential memory care, supported in part by Medi-Cal, aims to preserve",
  },
  "/library/dementia-vs-alzheimers-vs-lewy-body": {
    src: "/illustrations/couch-grandmother-grandkids-reading.png",
    alt:
      "Illustrated grandmother reading a book to two young grandchildren on a couch — representing the relationships dementia care planning aims to preserve",
  },
};

/** Resolve thumbnail for a route path (e.g. `/library/...`). Returns null if no art is registered. */
export function getArticleThumbnail(href: string | null | undefined): ArticleThumbnail | null {
  if (href == null || href === "") return null;
  const path = href.split("#")[0]?.split("?")[0] ?? href;
  return THUMBNAILS[path] ?? null;
}
