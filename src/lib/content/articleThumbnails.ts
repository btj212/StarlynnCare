/**
 * Thumbnails for article previews (homepage §04, mobile editorial strip, /library cards).
 * Keep `alt` identical to article `EditorialHero` usage for accessibility consistency.
 * See `docs/ILLUSTRATION_LIBRARY.md`.
 */
export type ArticleThumbnail = { src: string; alt: string };

const THUMBNAILS: Record<string, ArticleThumbnail> = {
  // ── Universal library articles ──────────────────────────────────────────────
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

  // ── Oregon articles ─────────────────────────────────────────────────────────
  "/oregon/memory-care-licensing": {
    src: "/illustrations/family.png",
    alt:
      "Illustrated family — representing the families researching Oregon DHS Memory Care Endorsement requirements and how to read a facility profile",
  },
  "/oregon/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the choice Oregon families face between memory care ALFs and skilled nursing facilities",
  },

  // ── Washington articles ─────────────────────────────────────────────────────
  "/washington/memory-care-licensing": {
    src: "/illustrations/family.png",
    alt:
      "Illustrated family — representing Washington families researching DSHS Specialized Dementia Care contracts and memory care licensing requirements",
  },
  "/washington/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the choice Washington families face between memory care ALFs and skilled nursing facilities",
  },

  "/washington/why-dshs-contract-isnt-a-quality-badge": {
    src: "/illustrations/family.png",
    alt:
      "Illustrated family — representing Washington families researching what a DSHS Dementia Care contract means for memory care quality",
  },
  "/washington/how-to-read-our-inspection-data": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the families who rely on inspection data to make Washington memory care decisions",
  },

  // ── Minnesota articles ──────────────────────────────────────────────────────
  "/minnesota/memory-care-licensing": {
    src: "/illustrations/family.png",
    alt:
      "Illustrated family — representing Minnesota families researching Assisted Living Facility with Dementia Care licensing under Minn. Stat. ch. 144G",
  },
  "/minnesota/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the choice Minnesota families face between memory care ALFs and skilled nursing facilities",
  },

  // ── Texas articles ──────────────────────────────────────────────────────────
  "/texas/type-a-b-c-licensing": {
    src: "/illustrations/family.png",
    alt:
      "Illustrated family — representing Texas families researching HHSC Type A, B, and C assisted living licensing requirements",
  },
  "/texas/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the choice Texas families face between memory care ALFs and skilled nursing facilities",
  },
};

/** Resolve thumbnail for a route path (e.g. `/library/...`). Returns null if no art is registered. */
export function getArticleThumbnail(href: string | null | undefined): ArticleThumbnail | null {
  if (href == null || href === "") return null;
  const path = href.split("#")[0]?.split("?")[0] ?? href;
  return THUMBNAILS[path] ?? null;
}
