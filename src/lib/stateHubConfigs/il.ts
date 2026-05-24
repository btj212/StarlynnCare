import { IL_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const ilStateConfig: StateHubConfig = {
  stateSlug: "illinois",
  stateCode: "IL",
  stateName: "Illinois",
  edition: "Vol. 01",
  regulatorAbbr: "IDPH",
  inspectionSrc: "IDPH Division of Assisted Living",
  showZipSearch: false,
  comingCounties: [],
  faqs: IL_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "FOIA-sourced inspection record",
      p: "Inspection and complaint records for Illinois Assisted Living Establishments (ALEs) and Shared Housing Establishments (SHEs) are sourced from the Illinois Department of Public Health (IDPH) Division of Assisted Living via a Freedom of Information Act request, covering January 2024 through May 2026. Per-event Statement of Deficiency PDFs are fetched from the IDPH LLCS portal.",
    },
    {
      n: "Step 02",
      t: "Memory care facilities only",
      p: "StarlynnCare indexes only facilities with a confirmed dementia or memory care focus — identified by name keywords (memory care, Alzheimer, dementia, reminiscence) or a portal-confirmed dementia special-care unit. Facilities with no memory care indication are excluded.",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to the IDPH LLCS portal record. Every violation shows its citation code, violation type (Type 1/2/3), and the exit date of the inspection visit. No data is fabricated or estimated.",
    },
  ],
  guidesHref: "/illinois/guides",
  stateArticles: [],
  editorialCards: [
    {
      kind: "Illinois licensing guide",
      title: "Illinois ALE and SHE licensing explained",
      desc: "What IDPH requires to operate an Assisted Living Establishment in Illinois, how Part 295 violations work, and how to read an Illinois facility profile.",
      meta: "Coming soon",
      href: null,
      live: false,
    },
    {
      kind: "Illinois decision guide",
      title: "Memory care vs. nursing home in Illinois",
      desc: "IDPH-regulated ALEs vs. CMS-regulated skilled nursing — different regulators, inspection records, Medicaid funding, and how to choose the right setting.",
      meta: "Coming soon",
      href: null,
      live: false,
    },
    {
      kind: "Illinois editorial library",
      title: "All Illinois guides & explainers",
      desc: "Decision guides, licensing explainers, and clinical primers — every StarlynnCare article for Illinois families.",
      meta: "Coming soon",
      href: null,
      live: false,
    },
  ],
};
