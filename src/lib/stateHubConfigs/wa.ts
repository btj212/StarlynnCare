import { WA_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const waStateConfig: StateHubConfig = {
  stateSlug: "washington",
  stateCode: "WA",
  stateName: "Washington",
  edition: "Vol. 01",
  regulatorAbbr: "DSHS",
  inspectionSrc: "DSHS ADSA",
  showZipSearch: false,
  comingCounties: [],
  faqs: WA_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Inspection and investigation reports for Specialized Dementia Care ALFs are sourced directly from the DSHS ALF Reports portal (fortress.wa.gov) — Washington's public residential care reporting system.",
    },
    {
      n: "Step 02",
      t: "Specialized Dementia Care contract only",
      p: "StarlynnCare indexes only facilities holding an active DSHS Specialized Dementia Care contract — a contract tier requiring dementia-specific staffing qualifications, behavioral support protocols, and enhanced supervision beyond a standard ALF license.",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to the DSHS source report. Every finding shows its download date. No black box.",
    },
  ],
  editorialCards: [
    {
      kind: "Comparison Hub",
      title: "Memory care vs. nursing home (SNF)",
      desc: "ALF memory care vs skilled nursing — licensing differences, Medicare framing, and what to verify on tours.",
      meta: "Live · Decision guide",
      href: "/library/memory-care-vs-nursing-home",
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
