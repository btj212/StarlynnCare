import { canonicalFor } from "@/lib/seo/canonical";

export type LocalHelpLink = {
  label: string;
  href: string;
  note?: string;
};

export type LocalHelp = {
  heading: string;
  links: LocalHelpLink[];
};

const HELP: Record<string, LocalHelp> = {
  "AZ:mesa": {
    heading: "How to check a Mesa home yourself",
    links: [
      {
        label: "AZ Care Check",
        href: "https://azcarecheck.azdhs.gov/",
        note: "ADHS inspection reports for every licensed home",
      },
      {
        label: "Area Agency on Aging, Region One",
        href: "https://www.aaaphx.org/",
        note: "Help line 602-264-4357",
      },
      {
        label: "Arizona memory care licensing",
        href: canonicalFor("/arizona/memory-care-licensing"),
        note: "Directed Care and A.A.C. R9-10-816 memory care services",
      },
    ],
  },
  "AZ:chandler": {
    heading: "How to check a Chandler home yourself",
    links: [
      {
        label: "AZ Care Check",
        href: "https://azcarecheck.azdhs.gov/",
        note: "ADHS inspection reports for every licensed home",
      },
      {
        label: "Area Agency on Aging, Region One",
        href: "https://www.aaaphx.org/",
        note: "Help line 602-264-4357",
      },
      {
        label: "Arizona memory care licensing",
        href: canonicalFor("/arizona/memory-care-licensing"),
      },
    ],
  },
  "AZ:tucson": {
    heading: "How to check a Tucson home yourself",
    links: [
      {
        label: "AZ Care Check",
        href: "https://azcarecheck.azdhs.gov/",
        note: "ADHS inspection reports for every licensed home",
      },
      {
        label: "Pima Council on Aging",
        href: "https://www.pcoa.org/",
        note: "Help line 520-790-7262",
      },
      {
        label: "Arizona memory care licensing",
        href: canonicalFor("/arizona/memory-care-licensing"),
      },
    ],
  },
  "WA:tacoma": {
    heading: "Local help in Pierce County",
    links: [
      {
        label: "Pierce County Aging & Disability Resources",
        href: "https://www.piercecountywa.gov/137/Aging-Disability-Resources",
        note: "ADRC 253-798-4600",
      },
      {
        label: "DSHS residential care lookup",
        href: "https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx",
        note: "Official inspection reports",
      },
      {
        label: "Alzheimer's Association Washington chapter",
        href: "https://www.alz.org/alzwa",
        note: "24/7 helpline 800-272-3900",
      },
    ],
  },
  "PA:pittsburgh": {
    heading: "Local help in Allegheny County",
    links: [
      {
        label: "Allegheny County SeniorLine",
        href: "https://www.alleghenycounty.us/services/aging",
        note: "412-350-5460",
      },
      {
        label: "Alzheimer's Association Greater Pennsylvania",
        href: "https://www.alz.org/pa",
        note: "412-261-5040",
      },
      {
        label: "PA DHS provider directory",
        href: "https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/",
        note: "Official Personal Care Home / Assisted Living lookup",
      },
    ],
  },
};

export function localHelpFor(stateCode: string, citySlug: string): LocalHelp | null {
  return HELP[`${stateCode.toUpperCase()}:${citySlug.toLowerCase()}`] ?? null;
}
