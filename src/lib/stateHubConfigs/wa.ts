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
  guidesHref: "/washington/guides",
  stateArticles: [
    {
      slug: "memory-care-licensing",
      title: "Washington memory care licensing — ALFs & Specialized Dementia Care",
      desc: "What DSHS requires for the Specialized Dementia Care contract, and how to read it on a profile.",
      tags: ["licensing", "inspection"],
      live: true,
    },
    {
      slug: "memory-care-vs-nursing-home",
      title: "Memory care vs. nursing home in Washington",
      desc: "DSHS vs. CMS — different regulators, inspection records, COPES Medicaid, and when to choose each setting.",
      tags: ["decision", "licensing"],
      live: true,
    },
  ],
  editorialCards: [
    {
      kind: "Washington licensing guide",
      title: "Washington ALF & Specialized Dementia Care licensing",
      desc: "What DSHS requires for the Specialized Dementia Care contract, how inspections work, and how to read a profile.",
      meta: "Live · Licensing guide",
      href: "/washington/memory-care-licensing",
      live: true,
    },
    {
      kind: "Washington decision guide",
      title: "Memory care vs. nursing home in Washington",
      desc: "DSHS vs. CMS — different regulators, inspection records, COPES Medicaid, and when to choose each setting.",
      meta: "Live · Decision guide",
      href: "/washington/memory-care-vs-nursing-home",
      live: true,
    },
    {
      kind: "Washington editorial library",
      title: "All Washington guides & explainers",
      desc: "Decision guides, licensing explainers, and clinical primers — every StarlynnCare article for Washington families.",
      meta: "Live · Full library",
      href: "/washington/guides",
      live: true,
    },
  ],
};
