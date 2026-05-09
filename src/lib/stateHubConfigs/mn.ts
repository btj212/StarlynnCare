import { MN_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const mnStateConfig: StateHubConfig = {
  stateSlug: "minnesota",
  stateCode: "MN",
  stateName: "Minnesota",
  edition: "Vol. 01",
  regulatorAbbr: "MDH",
  inspectionSrc: "MDH",
  showZipSearch: false,
  comingCounties: [],
  faqs: MN_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Complaint survey findings and inspection outcomes are sourced from the Minnesota Department of Health (MDH), which regulates Assisted Living Facilities under Minn. Stat. ch. 144G. MDH publishes licensing records and inspection outcomes publicly.",
    },
    {
      n: "Step 02",
      t: "Dementia Care license tier only",
      p: "StarlynnCare indexes only facilities with an active Assisted Living Facility with Dementia Care license — Minnesota's 2019 licensure reform tier requiring dementia-trained staff at all times, individualized dementia programming, and secured environments where clinically indicated.",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to the MDH source record. Every finding shows its download date. No black box.",
    },
  ],
  guidesHref: "/minnesota/guides",
  stateArticles: [
    {
      slug: "memory-care-licensing",
      title: "Minnesota memory care licensing — ALF with Dementia Care (Chapter 144G)",
      desc: "What MDH requires for the ALF-DC designation, how the 2021 reform changed licensing, and how to read it on a profile.",
      tags: ["licensing", "inspection"],
      live: true,
    },
    {
      slug: "memory-care-vs-nursing-home",
      title: "Memory care vs. nursing home in Minnesota",
      desc: "MDH vs. CMS — different regulators, inspection records, CADI/Elderly Waiver Medicaid, and when to choose each setting.",
      tags: ["decision", "licensing"],
      live: true,
    },
  ],
  editorialCards: [
    {
      kind: "Minnesota licensing guide",
      title: "Minnesota ALF with Dementia Care licensing (Chapter 144G)",
      desc: "What MDH requires for the ALF-DC designation, the 2021 Chapter 144G reform, and how to read a Minnesota profile.",
      meta: "Live · Licensing guide",
      href: "/minnesota/memory-care-licensing",
      live: true,
    },
    {
      kind: "Minnesota decision guide",
      title: "Memory care vs. nursing home in Minnesota",
      desc: "MDH vs. CMS — different regulators, inspection records, CADI/Elderly Waiver Medicaid, and when to choose each setting.",
      meta: "Live · Decision guide",
      href: "/minnesota/memory-care-vs-nursing-home",
      live: true,
    },
    {
      kind: "Minnesota editorial library",
      title: "All Minnesota guides & explainers",
      desc: "Decision guides, licensing explainers, and clinical primers — every StarlynnCare article for Minnesota families.",
      meta: "Live · Full library",
      href: "/minnesota/guides",
      live: true,
    },
  ],
};
