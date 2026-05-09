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
  stateArticles: [],
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
      desc: "Decision guides, clinical primers, and inspection explainers — every StarlynnCare article for Minnesota families.",
      meta: "Live · Full library",
      href: "/minnesota/guides",
      live: true,
    },
  ],
};
