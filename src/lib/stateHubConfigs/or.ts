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
  guidesHref: "/oregon/guides",
  stateArticles: [
    {
      slug: "memory-care-licensing",
      title: "Oregon memory care licensing — ALFs, RCFs & the Memory Care Endorsement",
      desc: "What Oregon DHS requires for memory care endorsement, and how to read it on a profile.",
      tags: ["licensing", "inspection"],
      live: true,
    },
    {
      slug: "memory-care-vs-nursing-home",
      title: "Memory care vs. nursing home in Oregon",
      desc: "Oregon DHS vs. CMS — different regulators, inspection records, and Medicaid funding streams.",
      tags: ["decision", "licensing"],
      live: true,
    },
  ],
  editorialCards: [
    {
      kind: "Oregon licensing guide",
      title: "Oregon ALF, RCF & Memory Care Endorsement explained",
      desc: "What Oregon DHS requires for the Memory Care Endorsement, how inspections work, and how to read a profile.",
      meta: "Live · Licensing guide",
      href: "/oregon/memory-care-licensing",
      live: true,
    },
    {
      kind: "Oregon decision guide",
      title: "Memory care vs. nursing home in Oregon",
      desc: "DHS vs. CMS — different regulators, inspection records, K Plan Medicaid, and when to choose each setting.",
      meta: "Live · Decision guide",
      href: "/oregon/memory-care-vs-nursing-home",
      live: true,
    },
    {
      kind: "Oregon editorial library",
      title: "All Oregon guides & explainers",
      desc: "Decision guides, licensing explainers, and clinical primers — every StarlynnCare article for Oregon families.",
      meta: "Live · Full library",
      href: "/oregon/guides",
      live: true,
    },
  ],
};
