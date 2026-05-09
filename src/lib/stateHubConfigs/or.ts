import { OR_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const orStateConfig: StateHubConfig = {
  stateSlug: "oregon",
  stateCode: "OR",
  stateName: "Oregon",
  edition: "Vol. 01",
  regulatorAbbr: "Oregon DHS",
  inspectionSrc: "Oregon DHS LTC",
  showZipSearch: false,
  comingCounties: [],
  faqs: OR_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Licensing violations and abuse investigation records for Memory Care Endorsed ALFs and RCFs are sourced directly from ltclicensing.oregon.gov — Oregon's public LTC licensing portal.",
    },
    {
      n: "Step 02",
      t: "Memory Care Endorsement only",
      p: "StarlynnCare indexes only facilities with an active Oregon DHS Memory Care Endorsement — an additional certification layer requiring secured environments, dedicated staff training, and individualized dementia care plans.",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to the Oregon DHS source record. Every finding shows its download date. No black box.",
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
