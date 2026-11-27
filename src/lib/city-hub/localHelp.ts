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
  "CA:san-diego": {
    heading: "Local help in San Diego County",
    links: [
      {
        label: "County of San Diego Aging & Independence Services Call Center",
        href: "https://www.sandiegocounty.gov/content/sdc/ais.html",
        note: "(800) 339-4661 — published in the AIS-funded Caregiver Handbook",
      },
      {
        label: "Choose Well San Diego",
        href: "https://www.choosewellsandiego.org/",
        note: "County-supported nursing home and residential care quality ratings",
      },
      {
        label: "Southern Caregiver Resource Center",
        href: "https://www.caregivercenter.org/",
        note: "Family caregiver support for San Diego and Imperial counties",
      },
    ],
  },
  "MN:st-paul": {
    heading: "Local help in Ramsey County",
    links: [
      {
        label: "Minnesota Aging Pathways / Senior LinkAge Line",
        href: "https://mn.gov/aging/",
        note: "1-800-333-2433",
      },
      {
        label: "Metropolitan Area Agency on Aging — Dementia Care Navigation",
        href: "https://www.tcaging.org/",
        note: "Twin Cities dementia-care navigation",
      },
      {
        label: "Ramsey County resource directory",
        href: "https://www.ramseycounty.us/residents/health-medical/clinics-services/older-adult-services",
        note: "Including Meals on Wheels of Ramsey County",
      },
    ],
  },
  "MO:kansas-city": {
    heading: "Local help in the Kansas City, MO metro",
    links: [
      {
        label: "MARC Aging & Adult Services",
        href: "https://www.marc.org/community/aging-adult-services",
        note: "816-421-4980 — Cass, Clay, Jackson, and Platte counties",
      },
      {
        label: "Sandwiched KC",
        href: "https://www.sandwichedkc.org/",
        note: "Caregiver resource portal for the Kansas City area",
      },
    ],
  },
  "WA:vancouver": {
    heading: "Local help in Clark County",
    links: [
      {
        label: "Area Agency on Aging & Disabilities of Southwest Washington, Clark County Resource Center: 360-694-8144",
        href: "https://helpingelders.org/resource-center",
      },
      {
        label: "DSHS assisted living lookup",
        href: "https://fortress.wa.gov/dshs/adsaapps/lookup/BHAdvLookup.aspx",
        note: "Which homes hold a Specialized Dementia Care contract",
      },
      {
        label: "Memory care in Portland, OR",
        href: canonicalFor("/oregon/portland"),
        note: "Across the Columbia River. Oregon DHS records, not DSHS.",
      },
    ],
  },
  "CO:denver": {
    heading: "Local help in Denver",
    links: [
      {
        label: "DRCOG Area Agency on Aging, Information & Assistance: 303-480-6700",
        href: "https://drcog.org/area-agency-aging/information-assistance",
      },
      {
        label: "Memory care in Colorado",
        href: canonicalFor("/colorado"),
      },
    ],
  },
  "CO:colorado-springs": {
    heading: "Local help in El Paso County",
    links: [
      {
        label: "Pikes Peak Area Agency on Aging, Senior Information & Assistance: (719) 471-2096",
        href: "https://ppacg.org/yellowbook/2025-26-yellow-book/",
        note: "Long-Term Care Ombudsman: (719) 301-6388",
      },
    ],
  },
  "IL:chicago": {
    heading: "Local help in Chicago",
    links: [
      {
        label: "City of Chicago Department of Family & Support Services, Senior Services Hotline: 312-744-4016",
        href: "https://www.chicago.gov/city/en/depts/fss/provdrs/senior.html",
        note: "The City's Long-Term Care Ombudsman program is linked from this page.",
      },
      {
        label: "Memory care in Illinois",
        href: canonicalFor("/illinois"),
      },
    ],
  },
  "OR:portland": {
    heading: "Local help in Multnomah County",
    links: [
      {
        label: "Multnomah County ADRC",
        href: "https://www.multco.us/ads",
        note: "503-988-3646 / adrc@multco.us",
      },
      {
        label: "Oregon licensed-settings search",
        href: "https://ltclicensing.oregon.gov",
        note: "DHS Long-Term Care Licensing portal",
      },
      {
        label: "Oregon Long-Term Care Ombudsman",
        href: "https://www.oregon.gov/ltco/Pages/index.aspx",
        note: "Independent advocate for residents in licensed settings",
      },
    ],
  },
};

export function localHelpFor(stateCode: string, citySlug: string): LocalHelp | null {
  return HELP[`${stateCode.toUpperCase()}:${citySlug.toLowerCase()}`] ?? null;
}
