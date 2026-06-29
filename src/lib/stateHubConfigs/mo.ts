import { MO_FAQS } from "@/lib/content/stateFaqs";
import type { StateHubConfig } from "./types";

export const moStateConfig: StateHubConfig = {
  stateSlug: "missouri",
  stateCode: "MO",
  stateName: "Missouri",
  edition: "Vol. 01",
  regulatorAbbr: "DHSS",
  inspectionSrc: "DHSS Section for Long-Term Care Regulation",
  showZipSearch: false,
  comingCounties: [],
  faqs: MO_FAQS,
  methodologySteps: [
    {
      n: "Step 01",
      t: "Pull the public record",
      p: "Facility licensing data comes directly from the Missouri DHSS LTC Directory, published on data.mo.gov (Socrata dataset fenu-sipv). Inspection and deficiency records were obtained via a public records (FOIA) request and cover 2018–2026. Both sources are primary, government-published datasets.",
    },
    {
      n: "Step 02",
      t: "Alzheimer's Special Care Disclosure + ALF** only",
      p: "Missouri has no standalone memory care license. StarlynnCare publishes facilities that meet at least one authoritative dementia-care signal: (1) the Alzheimer's Special Care Services Disclosure (Form MO 580-2637, §198.510 RSMo) — a legally mandated disclosure for facilities that advertise or specialize in Alzheimer's or dementia care — or (2) an ALF** license (§198.073.6 RSMo), which authorizes retaining residents who cannot self-evacuate. Standard ALF and RCF facilities without either signal are excluded.",
    },
    {
      n: "Step 03",
      t: "Publish, with source links",
      p: "Each profile links directly to its DHSS source record. Every inspection finding shows its survey category, date, and plain-language summary. No black box.",
    },
  ],
  guidesHref: "/missouri/guides",
  stateArticles: [
    {
      slug: "memory-care-licensing",
      title: "Missouri memory care licensing — ALF**, Alzheimer's Disclosure & 19 CSR",
      desc: "No standalone memory care license exists in MO. How §198.510 RSMo, ALF** status, and 19 CSR 30 define what StarlynnCare indexes — and how to read a profile.",
      tags: ["licensing", "inspection"],
      live: true,
    },
    {
      slug: "memory-care-vs-nursing-home",
      title: "Memory care vs. nursing home in Missouri",
      desc: "DHSS-licensed ALF/RCF vs. DHSS-licensed SNF/ICF — different regulators, inspection records, and MO HealthNet funding streams.",
      tags: ["decision", "licensing"],
      live: true,
    },
  ],
  editorialCards: [
    {
      kind: "Missouri licensing guide",
      title: "Missouri ALF**, Alzheimer's Disclosure & 19 CSR explained",
      desc: "How the Alzheimer's Special Care Disclosure, ALF** license, and 19 CSR 30 define memory care in Missouri — and how to read it on a profile.",
      meta: "Live · Licensing guide",
      href: "/missouri/memory-care-licensing",
      live: true,
    },
    {
      kind: "Missouri decision guide",
      title: "Memory care vs. nursing home in Missouri",
      desc: "DHSS ALF/RCF vs. SNF/ICF — different regulators, inspection records, and MO HealthNet (Medicaid) coverage.",
      meta: "Live · Decision guide",
      href: "/missouri/memory-care-vs-nursing-home",
      live: true,
    },
    {
      kind: "Missouri editorial library",
      title: "All Missouri guides & explainers",
      desc: "Decision guides, licensing explainers, and clinical primers — every StarlynnCare article for Missouri families.",
      meta: "Live · Full library",
      href: "/missouri/guides",
      live: true,
    },
  ],
};
