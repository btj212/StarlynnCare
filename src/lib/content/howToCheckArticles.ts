import type { FaqPair } from "@/components/articles/ArticleFaq";

export type HowToState = "AZ" | "CA" | "PA" | "WA";

export type HowToArticle = {
  code: HowToState;
  path: string;
  title: string;
  description: string;
  datePublished: string;
  badge: string;
  stateName: string;
  statePath: string;
  facilitiesPath: string;
  image: { src: string; alt: string };
  /** Direct answer to the title question, shown first. */
  answer: string;
  faq: readonly FaqPair[];
};

const CLEAN_RECORD: FaqPair = {
  q: "Does a clean inspection record mean a home is safe?",
  a: "No. An inspection records what the state found on the day it looked. Read the newest report, check whether later visits followed a complaint, and visit the home yourself.",
};

export const HOW_TO_CHECK: Record<HowToState, HowToArticle> = {
  AZ: {
    code: "AZ",
    path: "/arizona/how-to-check-a-memory-care-record",
    title: "How to check an Arizona memory care inspection record",
    description:
      "Where to look on AZ Care Check, what immediate jeopardy means on an Arizona profile, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Arizona",
    stateName: "Arizona",
    statePath: "/arizona",
    facilitiesPath: "/arizona/facilities",
    image: {
      src: "/illustrations/arizona-how-to-check.png",
      alt: "Illustrated windowsill with a clay bowl, a closed notebook, and a sprig of sage — standing in for looking up an Arizona inspection record",
    },
    answer:
      "Search the home's name on AZ Care Check, the Arizona Department of Health Services site, and open its inspection reports. Read the newest report first, then any visit that followed a complaint. The StarlynnCare page for the home lists the inspections we hold from the last three years.",
    faq: [
      {
        q: "Where do I find an Arizona assisted living home's inspection reports?",
        a: "On AZ Care Check, the Arizona Department of Health Services site. Search the home's name and open its record. The StarlynnCare page for the home links to that record when we stored a link.",
      },
      {
        q: "Is a Directed Care license the same as memory care in Arizona?",
        a: "ADHS told us in a June 2026 public records response that assisted living homes and centers licensed for directed care services are automatically authorized for memory care services. The license level is an authorization. It is not an inspection result.",
      },
      {
        q: "What does the red tag on an Arizona profile mean?",
        a: "Immediate jeopardy. High risk and enforcement are not that label. The count of homes with a serious citation on /data is wider: it also includes a finding stored at severity 3 or higher.",
      },
      CLEAN_RECORD,
      {
        q: "How far back does an Arizona profile go?",
        a: "A StarlynnCare profile lists inspections from the last three years. Older findings can stay in the record we hold.",
      },
    ],
  },
  CA: {
    code: "CA",
    path: "/california/how-to-check-a-memory-care-record",
    title: "How to check a California memory care inspection record",
    description:
      "Where to look on the CDSS care facility search, what a Type A citation is, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "California",
    stateName: "California",
    statePath: "/california",
    facilitiesPath: "/california/facilities",
    image: {
      src: "/illustrations/california-how-to-check.png",
      alt: "Illustrated empty chair by a window, with a closed book and a small succulent — standing in for looking up a California inspection record",
    },
    answer:
      "Search the home's name or facility number on the CDSS care facility search and open its reports. California must inspect every residential care facility for the elderly at least once a year, unannounced. Read the newest report first, and look for Type A citations.",
    faq: [
      {
        q: "How do I look up a California memory care home's inspection reports?",
        a: "Use the CDSS care facility search from the Community Care Licensing Division. Search the home's name or facility number and open its record. The StarlynnCare page for the home links to that record when we stored a link.",
      },
      {
        q: "How often does California inspect memory care homes?",
        a: "Health and Safety Code section 1569.33 has required an annual unannounced inspection of every residential care facility for the elderly since January 1, 2019. The department may inspect more often.",
      },
      {
        q: "How long does a California home have to fix a deficiency?",
        a: "Section 1569.33 says the home must fix a deficiency within 10 days of notice, unless the plan of correction sets a different date.",
      },
      {
        q: "How far back does the CDSS search go?",
        a: "CDSS says the search holds five years of facility information. For older records, or more detail on a citation, call the regional office listed on the facility's page.",
      },
      {
        q: "What is a Type A citation?",
        a: "Type A is the more serious of California's two citation classes. On a StarlynnCare profile the red tag is Type A or immediate jeopardy. Type B is not that tag.",
      },
      CLEAN_RECORD,
    ],
  },
  PA: {
    code: "PA",
    path: "/pennsylvania/how-to-check-a-memory-care-record",
    title: "How to check a Pennsylvania memory care inspection record",
    description:
      "Where to look in the Pennsylvania DHS provider directory, what immediate jeopardy and a provisional license mean, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Pennsylvania",
    stateName: "Pennsylvania",
    statePath: "/pennsylvania",
    facilitiesPath: "/pennsylvania/facilities",
    image: {
      src: "/illustrations/pennsylvania-how-to-check.png",
      alt: "Illustrated brick step with a closed umbrella and a fern — standing in for looking up a Pennsylvania inspection record",
    },
    answer:
      "Search the home's name in the Department of Human Services provider directory and open its inspection results. Personal care homes and assisted living residences are licensed by DHS, not the Department of Health. Read the newest inspection first.",
    faq: [
      {
        q: "Where are Pennsylvania personal care home inspection results?",
        a: "In the Department of Human Services provider directory. Choose the Office of Long-Term Living as the program office and type at least four characters of the home's name. DHS says the directory refreshes daily.",
      },
      {
        q: "Which agency licenses Pennsylvania memory care homes?",
        a: "The Department of Human Services. Personal care homes follow 55 Pa. Code Chapter 2600 and assisted living residences follow Chapter 2800.",
      },
      {
        q: "What counts as a red tag on a Pennsylvania profile?",
        a: "Immediate jeopardy, revocation, substantiated abuse, and a provisional license. A civil money penalty is not a red tag.",
      },
      {
        q: "Does StarlynnCare show which Pennsylvania inspections followed a complaint?",
        a: "Not yet. The Pennsylvania files we hold do not mark which inspections followed a complaint.",
      },
      CLEAN_RECORD,
    ],
  },
  WA: {
    code: "WA",
    path: "/washington/how-to-check-a-memory-care-record",
    title: "How to check a Washington memory care inspection record",
    description:
      "Where to look on the DSHS lookup, what immediate jeopardy means on a Washington profile, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Washington",
    stateName: "Washington",
    statePath: "/washington",
    facilitiesPath: "/washington/facilities",
    image: {
      src: "/illustrations/washington-how-to-check.png",
      alt: "Illustrated table by a rainy window, with a teapot and a closed folder — standing in for looking up a Washington inspection record",
    },
    answer:
      "Find the home on the DSHS assisted living facility locator and open its ALF Reports page. That page lists routine inspections, complaint investigations, enforcement letters, and fire inspections. Read the newest inspection and every investigation since.",
    faq: [
      {
        q: "Where are Washington assisted living inspection reports?",
        a: "On the DSHS assisted living facility locator. Search by location or facility name, then open the home's ALF Reports page. The StarlynnCare page for the home links to the report we stored.",
      },
      {
        q: "How often does Washington inspect assisted living facilities?",
        a: "DSHS says it inspects each assisted living facility at least every 18 months. Investigations follow reported concerns. The State Fire Marshal inspects at initial licensing, after a complaint, or each year.",
      },
      {
        q: "Why are parts of a Washington report blacked out?",
        a: "DSHS may block out information that is confidential or could identify a resident.",
      },
      {
        q: "Is a DSHS dementia-care contract a quality rating?",
        a: "No. It is a contract to serve residents with dementia. It does not grade the home.",
      },
      CLEAN_RECORD,
    ],
  },
};
