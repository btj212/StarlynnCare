import { AZ_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const azStateConfig: StateHubConfig = {
  stateSlug: "arizona",
  stateCode: "AZ",
  stateName: "Arizona",
  edition: "Vol. 01",
  regulatorAbbr: "ADHS",
  inspectionSrc: "ADHS BRFL / AZ Care Check",
  showZipSearch: false,
  comingCounties: [],
  faqs: AZ_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Facility licensing data is sourced directly from the ADHS Bureau of Residential Facilities Licensing (BRFL) via the ADHS ArcGIS Open Data Hub and the ADHS Providers & Facility Databases (monthly Excel exports). Inspection records are fetched directly from the AZ Care Check platform (azcarecheck.azdhs.gov) — the same source that powers official ADHS consumer reporting.",
    },
    {
      n: "Step 02",
      t: "Directed Care license level only",
      p: "StarlynnCare indexes only facilities with an active ADHS Directed Care license level — the highest tier authorized to serve residents with dementia, cognitive impairment, or behavioral symptoms requiring continuous supervision. Supervisory and Personal Care facilities are excluded. ADHS confirmed in a June 2026 public records response: \"Arizona assisted living homes and assisted living centers licensed for directed care services are automatically authorized for memory care services.\"",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to the facility's ADHS source record and AZ Care Check page. Every inspection finding shows its exit date and plain-language summary. No black box.",
    },
  ],
  guidesHref: "/arizona/guides",
  stateArticles: [
    {
      slug: "memory-care-licensing",
      title: "Arizona memory care licensing — ALH, ALC & the Directed Care license level",
      desc: "What ADHS requires for Directed Care authorization, the HB2764 Memory Care subclass, and how to read it on a profile.",
      tags: ["licensing", "inspection"],
      live: true,
    },
    {
      slug: "memory-care-vs-nursing-home",
      title: "Memory care vs. nursing home in Arizona",
      desc: "ADHS vs. CMS — different regulators, inspection records, and ALTCS Medicaid funding streams.",
      tags: ["decision", "licensing"],
      live: true,
    },
  ],
  editorialCards: [
    {
      kind: "Arizona licensing guide",
      title: "Arizona ALH, ALC & Directed Care license explained",
      desc: "What ADHS requires for Directed Care authorization, how inspections work, and how to read a profile.",
      meta: "Live · Licensing guide",
      href: "/arizona/memory-care-licensing",
      live: true,
    },
    {
      kind: "Arizona decision guide",
      title: "Memory care vs. nursing home in Arizona",
      desc: "ADHS vs. CMS — different regulators, inspection records, ALTCS Medicaid, and when to choose each setting.",
      meta: "Live · Decision guide",
      href: "/arizona/memory-care-vs-nursing-home",
      live: true,
    },
    {
      kind: "Arizona editorial library",
      title: "All Arizona guides & explainers",
      desc: "Decision guides, licensing explainers, and clinical primers — every StarlynnCare article for Arizona families.",
      meta: "Live · Full library",
      href: "/arizona/guides",
      live: true,
    },
  ],
};
