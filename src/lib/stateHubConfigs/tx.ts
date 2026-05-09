import { TX_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const txStateConfig: StateHubConfig = {
  stateSlug: "texas",
  stateCode: "TX",
  stateName: "Texas",
  edition: "Vol. 01",
  regulatorAbbr: "HHSC",
  inspectionSrc: "HHSC LTCR",
  showZipSearch: false,
  comingCounties: [],
  faqs: TX_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Inspection findings for Alzheimer-certified assisted living facilities are sourced directly from Texas HHSC Long-Term Care Regulation (LTCR) public records. StarlynnCare indexes only facilities with active Alzheimer Certification where noted.",
    },
    {
      n: "Step 02",
      t: "Note the license type difference",
      p: "Texas ALF license Types A, B, and C describe facility capability under HHSC rules — not citation severity. Do not conflate these with California's Type-A / Type-B deficiency severity labels. StarlynnCare shows each state's findings using the regulator's own severity language.",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to the HHSC source record and shows source URLs and visit dates. No black box.",
    },
  ],
  editorialCards: [
    {
      kind: "Texas licensing",
      title: "Type A, B, and C assisted living in Texas",
      desc: "HHSC license classes describe facility capability — not the same as California Type A / Type B deficiency severity. How to read both on a profile.",
      meta: "Guide · In progress",
      href: null,
      live: false,
    },
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
