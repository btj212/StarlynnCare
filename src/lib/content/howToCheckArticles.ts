export type HowToState = "AZ" | "CA" | "PA" | "WA";

export type HowToArticle = {
  code: HowToState;
  path: string;
  title: string;
  description: string;
  datePublished: string;
  badge: string;
  stateName: string;
  statePath: string;
  facilitiesPath: string;
  image: { src: string; alt: string };
};

export const HOW_TO_CHECK: Record<HowToState, HowToArticle> = {
  AZ: {
    code: "AZ",
    path: "/arizona/how-to-check-a-memory-care-record",
    title: "How to check an Arizona memory care inspection record",
    description:
      "Where to look on AZ Care Check, what immediate jeopardy means on an Arizona profile, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Arizona",
    stateName: "Arizona",
    statePath: "/arizona",
    facilitiesPath: "/arizona/facilities",
    image: {
      src: "/illustrations/arizona-how-to-check.png",
      alt: "Illustrated windowsill with a clay bowl, a closed notebook, and a sprig of sage — standing in for looking up an Arizona inspection record",
    },
  },
  CA: {
    code: "CA",
    path: "/california/how-to-check-a-memory-care-record",
    title: "How to check a California memory care inspection record",
    description:
      "Where to look on the CDSS care facility search, what a Type A citation is, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "California",
    stateName: "California",
    statePath: "/california",
    facilitiesPath: "/california/facilities",
    image: {
      src: "/illustrations/california-how-to-check.png",
      alt: "Illustrated empty chair by a window, with a closed book and a small succulent — standing in for looking up a California inspection record",
    },
  },
  PA: {
    code: "PA",
    path: "/pennsylvania/how-to-check-a-memory-care-record",
    title: "How to check a Pennsylvania memory care inspection record",
    description:
      "Where to look in the Pennsylvania DHS provider directory, what immediate jeopardy and a provisional license mean, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Pennsylvania",
    stateName: "Pennsylvania",
    statePath: "/pennsylvania",
    facilitiesPath: "/pennsylvania/facilities",
    image: {
      src: "/illustrations/pennsylvania-how-to-check.png",
      alt: "Illustrated brick step with a closed umbrella and a fern — standing in for looking up a Pennsylvania inspection record",
    },
  },
  WA: {
    code: "WA",
    path: "/washington/how-to-check-a-memory-care-record",
    title: "How to check a Washington memory care inspection record",
    description:
      "Where to look on the DSHS lookup, what immediate jeopardy means on a Washington profile, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Washington",
    stateName: "Washington",
    statePath: "/washington",
    facilitiesPath: "/washington/facilities",
    image: {
      src: "/illustrations/washington-how-to-check.png",
      alt: "Illustrated table by a rainy window, with a teapot and a closed folder — standing in for looking up a Washington inspection record",
    },
  },
};
