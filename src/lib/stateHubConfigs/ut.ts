import { UT_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const utStateConfig: StateHubConfig = {
  stateSlug: "utah",
  stateCode: "UT",
  stateName: "Utah",
  edition: "Vol. 01",
  regulatorAbbr: "DLBC",
  inspectionSrc: "Utah DLBC / CMS",
  showZipSearch: false,
  comingCounties: [],
  faqs: UT_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Licensing inspection records for Type I and Type II Assisted Living Facilities are sourced directly from the Utah Division of Licensing and Background Checks (DLBC) public portal at ccl.utah.gov, supplemented by CMS data for nursing facilities.",
    },
    {
      n: "Step 02",
      t: "Memory care facilities only",
      p: "StarlynnCare indexes facilities licensed under Utah Admin. Code R432-270 as Type I or Type II ALFs — the license types that serve residents with dementia and Alzheimer's in Utah's regulatory framework.",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to the DLBC source record. Every finding shows its download date. No black box.",
    },
  ],
  guidesHref: "/utah/guides",
  stateArticles: [],
  editorialCards: [
    {
      kind: "Utah licensing guide",
      title: "Utah Type I & Type II ALF licensing explained",
      desc: "What DLBC requires for assisted living licensure in Utah, how inspections work under R432-270, and how to read a Utah facility profile.",
      meta: "Coming soon",
      href: null,
      live: false,
    },
    {
      kind: "Utah decision guide",
      title: "Memory care vs. nursing home in Utah",
      desc: "DLBC vs. CMS — different regulators, inspection records, Medicaid funding streams, and when to choose each setting for a loved one with dementia.",
      meta: "Coming soon",
      href: null,
      live: false,
    },
    {
      kind: "Utah editorial library",
      title: "All Utah guides & explainers",
      desc: "Decision guides, licensing explainers, and clinical primers — every StarlynnCare article for Utah families.",
      meta: "Coming soon",
      href: null,
      live: false,
    },
  ],
};
