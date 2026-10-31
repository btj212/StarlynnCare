export const SERIOUS_EXPLAINER = {
  path: "/library/what-a-serious-citation-means",
  title: "What a serious citation means in each state",
  description:
    "The word serious is not one legal term. This page maps each state's red tag — Type A, Type 1, immediate jeopardy, and the labels that are not that tag — and says how the count on /data is wider.",
  datePublished: "2026-10-31",
  image: {
    src: "/illustrations/what-a-serious-citation-means.png",
    alt: "Illustrated table with four plain closed envelopes, a pencil, and a sprig of greenery — standing in for the different words states use for a serious citation",
  },
  faq: [
    {
      q: "Is a serious citation the same in every state?",
      a: "No. Each state writes its own top label: Type A in California, Type 1 in Illinois, and immediate jeopardy in most other states we cover. Pennsylvania also treats revocation, substantiated abuse, and a provisional license as red tags on a profile.",
    },
    {
      q: "What is the most serious citation in California memory care?",
      a: "On a California profile, the red tag is Type A or immediate jeopardy. Type B is not that tag.",
    },
    {
      q: "Does a serious citation mean the home is unsafe today?",
      a: "It records what the state found on the inspection date. Read the date, the finding text, and any later inspection of the same home.",
    },
    {
      q: "Why does the StarlynnCare count include findings the profile does not tag red?",
      a: "The count uses one rule across states: a Type A finding, or a finding stored at severity 3 or higher, in the last 24 months. Some profiles tag only the state's top label, so the count can be wider than the red tags.",
    },
    {
      q: "Can I compare serious citations between two states?",
      a: "Only roughly. States label, schedule, and write findings differently. Compare a home with others in its own state first, then use the same 24-month count on /data across states.",
    },
  ],
} as const;
