import { CA_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const caStateConfig: StateHubConfig = {
  stateSlug: "california",
  stateCode: "CA",
  stateName: "California",
  edition: "Vol. 02",
  regulatorAbbr: "CDSS",
  inspectionSrc: "CDSS / CMS",
  showZipSearch: true,
  comingCounties: [],
  faqs: CA_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Inspection reports, deficiency findings, and complaint outcomes pulled directly from CDSS Community Care Licensing — weekly, with archived snapshots.",
    },
    {
      n: "Step 02",
      t: "Compare to peers",
      p: "Each facility's citations are benchmarked against similar California facilities — same license type, comparable bed count, same 36-month window.",
    },
    {
      n: "Step 03",
      t: "Publish, with footnotes",
      p: "Each profile shows citation numbers, dates, and severity levels. No black box. Every data point links to its source record.",
    },
  ],
  guidesHref: "/library",
  stateArticles: [
    {
      slug: "memory-care-licensing",
      title: "California memory care licensing: RCFEs, CDSS & Type A/B deficiencies",
      desc: "How California licenses memory care under the RCFE framework, what the Alzheimer's Special Care Disclosure means, and how to read a California facility's inspection record.",
      tags: ["licensing"],
      live: true,
    },
  ],
  editorialCards: [
    {
      kind: "California licensing guide",
      title: "California memory care licensing: RCFEs, CDSS & Type A/B deficiencies",
      desc: "How California licenses memory care under the RCFE framework, what the Alzheimer's Special Care Disclosure means, and how to read a California facility's inspection record.",
      meta: "Live · Licensing guide",
      href: "/california/memory-care-licensing",
      live: true,
    },
    {
      kind: "Annual Data Report · 2026",
      title: "The State of Memory Care in California",
      desc: "Year-over-year analysis of inspection reports across licensed facilities — deficiency rates by county, severity trends, and the operators with the cleanest and most concerning records.",
      meta: "Live · Dataset overview",
      href: "/data",
      live: true,
    },
    {
      kind: "Regional costs",
      title: "Memory care costs by California city & region",
      desc: "Benchmark monthly bands by metro — planning estimates families use before facility-specific quotes.",
      meta: "Live · Regional bands",
      href: "/california/cost-by-city",
      live: true,
    },
    {
      kind: "Comparison Hub",
      title: "Memory care vs. nursing home (SNF)",
      desc: "RCFE memory care vs skilled nursing — licensing, Medicare framing, Medi-Cal context, and what to verify on tours.",
      meta: "Live · Decision guide",
      href: "/library/memory-care-vs-nursing-home",
      live: true,
    },
    {
      kind: "California payer literacy",
      title: "Medi-Cal & memory care — what families need to know",
      desc: "Room & board vs services, Assisted Living Waiver context, and pairing payer questions with inspection history.",
      meta: "Live · PHN-reviewed",
      href: "/library/medi-cal-and-memory-care",
      live: true,
    },
    {
      kind: "Decision framework",
      title: "When is it time for memory care?",
      desc: "Safety signals, parallel clinical + regulatory tracks, and tour discipline before you sign.",
      meta: "Live · Family guide",
      href: "/library/when-is-it-time-for-memory-care",
      live: true,
    },
    {
      kind: "Editorial library",
      title: "All guides & explainers",
      desc: "Costs, citations, tours, glossary, dementia vocabulary — every StarlynnCare article in one index.",
      meta: "Live · Full library",
      href: "/library",
      live: true,
    },
  ],
};
