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

  // ── California articles ─────────────────────────────────────────────────────
  "/california/37-questions-to-ask-on-a-tour": {
    src: "/illustrations/family-facility-tour-hallway.png",
    alt:
      "Illustrated daughter and elderly mother being welcomed by a staff member in a sunlit facility hallway — representing a family touring a memory care facility",
  },
  "/california/cost-guide": {
    src: "/illustrations/family-financial-planning-table.png",
    alt:
      "Illustrated family and elderly grandfather sitting at a table with a calculator and financial documents — representing the cost planning conversations families have when researching memory care",
  },

  // ── Oregon articles ─────────────────────────────────────────────────────────
  "/oregon/memory-care-licensing": {
    src: "/illustrations/residential-care-home-exterior.png",
    alt:
      "Illustrated exterior of a residential care home with a garden and an elderly resident on the porch — representing the licensed residential care settings Oregon DHS regulates",
  },
  "/oregon/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the choice Oregon families face between memory care ALFs and skilled nursing facilities",
  },

  // ── Washington articles ─────────────────────────────────────────────────────
  "/washington/memory-care-licensing": {
    src: "/illustrations/residential-care-home-exterior.png",
    alt:
      "Illustrated exterior of a residential care home with a garden and an elderly resident on the porch — representing the licensed memory care settings DSHS regulates in Washington",
  },
  "/washington/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the choice Washington families face between memory care ALFs and skilled nursing facilities",
  },
  "/washington/why-dshs-contract-isnt-a-quality-badge": {
    src: "/illustrations/desk-family-reviewing-records.png",
    alt:
      "Illustrated adult daughter and elderly grandmother reviewing documents together at a desk under a lamp — representing families reading the public DSHS inspection record",
  },
  "/washington/how-to-read-our-inspection-data": {
    src: "/illustrations/person-reading-chair-window.png",
    alt:
      "Illustrated person reading a report in an armchair by a sunny window — representing a family member researching Washington inspection data before making a memory care decision",
  },

  // ── Minnesota articles ──────────────────────────────────────────────────────
  "/minnesota/memory-care-licensing": {
    src: "/illustrations/residential-care-home-exterior.png",
    alt:
      "Illustrated exterior of a residential care home with a garden and an elderly resident on the porch — representing the licensed memory care settings Minnesota DHS regulates",
  },
  "/minnesota/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the choice Minnesota families face between memory care ALFs and skilled nursing facilities",
  },

  // ── Texas articles ──────────────────────────────────────────────────────────
  "/texas/type-a-b-c-licensing": {
    src: "/illustrations/residential-care-home-exterior.png",
    alt:
      "Illustrated exterior of a residential care home with a garden and an elderly resident on the porch — representing the Texas HHSC licensed assisted living facilities families are choosing between",
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
