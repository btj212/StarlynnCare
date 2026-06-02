import { PA_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const paStateConfig: StateHubConfig = {
  stateSlug: "pennsylvania",
  stateCode: "PA",
  stateName: "Pennsylvania",
  edition: "Vol. 01",
  regulatorAbbr: "PA DHS",
  inspectionSrc: "PA DHS OLTL",
  showZipSearch: false,
  comingCounties: [],
  faqs: PA_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Inspection findings are sourced from the Pennsylvania Department of Human Services (DHS) Office of Long-Term Living (OLTL), which regulates Personal Care Homes under 55 Pa Code Chapter 2600 and Assisted Living Residences under Chapter 2800. DHS publishes inspection PDFs on its provider directory portal — StarlynnCare downloads and parses each one.",
    },
    {
      n: "Step 02",
      t: "Memory care designation only",
      p: "StarlynnCare indexes only facilities with a DHS-recognized 'Special Care' or 'Secure Dementia Care Unit' designation in the OLTL provider directory, or facilities licensed as Assisted Living — Special Care. These are government-verified designations, not self-reported marketing claims.",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to the DHS source record. Every citation shows its inspection date and the specific 55 Pa Code section cited. No black box.",
    },
  ],
  guidesHref: "/pennsylvania/guides",
  stateArticles: [
    {
      slug: "memory-care-licensing",
      title: "Pennsylvania memory care licensing — PCH vs. ALR and the Special Care designation",
      desc: "What DHS OLTL requires for licensed memory care, how Personal Care Homes and Assisted Living Residences differ, and how to read the Special Care / Secure Dementia Care Unit designation on a profile.",
      tags: ["licensing", "inspection"],
      live: true,
    },
    {
      slug: "memory-care-vs-nursing-home",
      title: "Memory care vs. nursing home in Pennsylvania",
      desc: "DHS-licensed memory care vs. PA nursing facilities (DOH + CMS Care Compare) — different regulators, different inspection records, and when to choose each care setting.",
      tags: ["decision", "licensing"],
      live: true,
    },
  ],
  editorialCards: [
    {
      kind: "Pennsylvania licensing guide",
      title: "Pennsylvania memory care licensing (PCH vs. ALR)",
      desc: "What DHS OLTL requires for licensed memory care, how PCH and ALR differ, and the Special Care / Secure Dementia Care Unit designation.",
      meta: "Live · Licensing guide",
      href: "/pennsylvania/memory-care-licensing",
      live: true,
    },
    {
      kind: "Pennsylvania decision guide",
      title: "Memory care vs. nursing home in Pennsylvania",
      desc: "DHS-licensed memory care vs. PA nursing facilities — different regulators, different inspection records, when to choose each.",
      meta: "Live · Decision guide",
      href: "/pennsylvania/memory-care-vs-nursing-home",
      live: true,
    },
    {
      kind: "Pennsylvania editorial library",
      title: "All Pennsylvania guides & explainers",
      desc: "Decision guides, licensing explainers, and clinical primers — every StarlynnCare article for Pennsylvania families.",
      meta: "Live · Full library",
      href: "/pennsylvania/guides",
      live: true,
    },
  ],
};
