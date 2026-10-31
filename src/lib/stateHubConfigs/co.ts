import { CO_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const coStateConfig: StateHubConfig = {
  stateSlug: "colorado",
  stateCode: "CO",
  stateName: "Colorado",
  edition: "Vol. 01",
  regulatorAbbr: "CDPHE",
  inspectionSrc: "CDPHE assisted living records and CMS nursing-home surveys",
  inspectionDelta: "Assisted-living citations as of May 18, 2026",
  showZipSearch: false,
  comingCounties: [],
  faqs: CO_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Start with the official lists",
      p: "Assisted living residences come from the CDPHE health-facilities directory. Nursing homes come from the CMS provider file. A home stays in the list it came from. A shared name and street is noted for review and is not treated as the same facility.",
    },
    {
      n: "Step 02",
      t: "Do not invent a state memory-care license",
      p: "CDPHE does not publish a facility-level secure-environment roster. Dementia training is required for every assisted living residence, so training is not a memory-care designation. A home is listed as memory care only when its name, a verified memory-care chain, or two independent directories say so. Anything less stays unpublished.",
    },
    {
      n: "Step 03",
      t: "Keep the two inspection records apart",
      p: "Assisted living citations use Colorado Level A through E. Nursing-home citations use CMS F-tags and letters A through L. A profile names which record you are reading. The two are not ranked against each other.",
    },
  ],
  guidesHref: "/colorado/guides",
  stateArticles: [
    {
      slug: "memory-care-licensing",
      title: "How Colorado licenses assisted living",
      desc: "CDPHE licenses assisted living residences under Chapter 7. There is no separate memory-care license and no public secure-environment roster.",
      tags: ["licensing", "inspection"],
      live: true,
    },
    {
      slug: "memory-care-vs-nursing-home",
      title: "Assisted living and nursing homes in Colorado",
      desc: "CDPHE Level A–E citations and CMS F-tags are different records. They are not compared on the same scale.",
      tags: ["decision", "licensing"],
      live: true,
    },
  ],
  editorialCards: [
    {
      kind: "Colorado licensing guide",
      title: "How Colorado licenses assisted living",
      desc: "Chapter 7, the optional secure environment, and why dementia training is not a memory-care designation.",
      meta: "Live · Licensing guide",
      href: "/colorado/memory-care-licensing",
      live: true,
    },
    {
      kind: "Colorado decision guide",
      title: "Assisted living and nursing homes",
      desc: "What CDPHE licenses, what CMS surveys, and why the severity letters are not interchangeable.",
      meta: "Live · Decision guide",
      href: "/colorado/memory-care-vs-nursing-home",
      live: true,
    },
    {
      kind: "Colorado editorial library",
      title: "Colorado guides",
      desc: "Licensing and the difference between an assisted living residence and a nursing home.",
      meta: "Live · Full library",
      href: "/colorado/guides",
      live: true,
    },
  ],
};
