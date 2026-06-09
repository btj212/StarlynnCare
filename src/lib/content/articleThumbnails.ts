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

  // ── Pennsylvania articles ───────────────────────────────────────────────────
  "/pennsylvania/what-is-a-personal-care-home": {
    src: "/illustrations/hallway-family-staff-conversation.png",
    alt:
      "Illustrated family member and care staff in conversation in a sunlit facility hallway — representing the day-to-day personal care environment inside a Pennsylvania DHS-licensed PCH",
  },
  "/pennsylvania/personal-care-home-vs-assisted-living": {
    src: "/illustrations/desk-family-reviewing-records.png",
    alt:
      "Illustrated adult daughter and elderly grandmother reviewing documents together at a desk under a lamp — representing a Pennsylvania family comparing PCH and ALR inspection records before choosing a facility",
  },
  "/pennsylvania/personal-care-home-cost": {
    src: "/illustrations/family-financial-planning-table.png",
    alt:
      "Illustrated family and elderly grandfather sitting at a table with a calculator and financial documents — representing the cost planning conversations Pennsylvania families have when researching personal care home pricing",
  },
  "/pennsylvania/memory-care-licensing": {
    src: "/illustrations/residential-care-home-exterior.png",
    alt:
      "Illustrated exterior of a residential care home with a garden and an elderly resident on the porch — representing the PA DHS OLTL licensed PCH and ALR settings this guide covers",
  },
  "/pennsylvania/memory-care-vs-nursing-home": {
    src: "/illustrations/beach-grandparent-grandchild.png",
    alt:
      "Illustrated grandparent and grandchild walking together — representing the choice Pennsylvania families face between DHS-licensed memory care and DOH/CMS-regulated skilled nursing facilities",
  },
  "/pennsylvania/insights/pa-rural-home-highest-immediate-jeopardy": {
    src: "/illustrations/pa-insights/rural-care-home-dusk-isolation.png",
    alt:
      "Illustrated rural care facility at the end of a long road at dusk, alone in open countryside — representing remoteness and limited oversight",
  },
  "/pennsylvania/insights/philadelphia-suburbs-worst-records": {
    src: "/illustrations/pa-insights/affluent-suburban-residence-empty.png",
    alt:
      "Illustrated grand brick suburban residence with manicured landscaping and dark, empty windows — representing affluent address and surface presentation that does not match the inspection record underneath",
  },
  "/pennsylvania/insights/bigger-not-safer": {
    src: "/illustrations/pa-insights/large-facility-scale-lone-figure.png",
    alt:
      "Illustrated vast institutional building with rows of identical windows and a single small figure in the courtyard — representing how facility scale dwarfs individual residents",
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
