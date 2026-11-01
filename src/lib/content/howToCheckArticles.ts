import type { FaqPair } from "@/components/articles/ArticleFaq";

export type HowToState = "AZ" | "CA" | "IL" | "MN" | "OR" | "PA" | "WA";

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
  OR: {
    code: "OR",
    path: "/oregon/how-to-check-a-memory-care-record",
    title: "How to check an Oregon memory care inspection record",
    description:
      "Where to look on the Oregon long-term care licensing site, what a level 4 finding means, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Oregon",
    stateName: "Oregon",
    statePath: "/oregon",
    facilitiesPath: "/oregon/facilities",
    image: {
      src: "/illustrations/oregon-how-to-check.png",
      alt: "Illustrated rainy windowsill with a fern, a ceramic cup, and a closed folder — standing in for looking up an Oregon inspection record",
    },
    answer:
      "Search the home's name on the Oregon long-term care licensing site and open its survey record. DHS says assisted living and residential care facilities are surveyed every 24 months, and that the site updates every 24 hours. A memory care endorsement is permission to advertise memory care. It is not an inspection result.",
    faq: [
      {
        q: "Where are Oregon assisted living inspection records?",
        a: "On the Oregon Department of Human Services long-term care licensing site. Search the home's name and open its record. The StarlynnCare page for the home links to that record when we stored a link.",
      },
      {
        q: "How often does Oregon survey an assisted living facility?",
        a: "DHS says assisted living and residential care facilities are surveyed every 24 months, and an endorsed memory care unit is surveyed on its facility's schedule.",
      },
      {
        q: "Does a memory care endorsement mean the home passed inspection?",
        a: "No. The endorsement is the permission a home must have before it advertises memory care. It is not a grade.",
      },
      {
        q: "What does the red tag on an Oregon profile mean?",
        a: "Level 4, labeled IJ. Level 3 is not that tag. The count of homes with a serious citation on /data is wider: it also includes a finding stored at severity 3.",
      },
      CLEAN_RECORD,
    ],
  },
  IL: {
    code: "IL",
    path: "/illinois/how-to-check-a-memory-care-record",
    title: "How to check an Illinois memory care inspection record",
    description:
      "Where to look on the Illinois Department of Public Health facility lookup, what a Type 1 citation is, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Illinois",
    stateName: "Illinois",
    statePath: "/illinois",
    facilitiesPath: "/illinois/facilities",
    image: {
      src: "/illustrations/illinois-how-to-check.png",
      alt: "Illustrated empty chair by a window, with a closed notebook and dried wheat in a jar — standing in for looking up an Illinois inspection record",
    },
    answer:
      "Search the home's name on the Illinois Department of Public Health facility lookup and open its record. Assisted living establishments follow 77 Ill. Adm. Code 295. On a StarlynnCare profile the red tag is Type 1. A rule number names the rule. It does not, by itself, describe what the inspector saw.",
    faq: [
      {
        q: "Where do I look up an Illinois assisted living inspection?",
        a: "On the Illinois Department of Public Health facility lookup. Search the home's name and open its record. The StarlynnCare page for the home lists the inspections we hold.",
      },
      {
        q: "What is a Type 1 citation in Illinois?",
        a: "Type 1 is the red tag on an Illinois profile. A Type 1 citation is not a memory care designation.",
      },
      {
        q: "Does a rule number tell me what the inspector saw?",
        a: "No. When the public file names a rule, such as a section of 77 Ill. Adm. Code 295, that names the rule. It does not describe what the inspector saw.",
      },
      CLEAN_RECORD,
    ],
  },
  MN: {
    code: "MN",
    path: "/minnesota/how-to-check-a-memory-care-record",
    title: "How to check a Minnesota memory care inspection record",
    description:
      "Where to look in the Minnesota Department of Health provider directory, what an immediate-jeopardy flag means, and how many published homes have an inspection on file.",
    datePublished: "2026-10-31",
    badge: "Minnesota",
    stateName: "Minnesota",
    statePath: "/minnesota",
    facilitiesPath: "/minnesota/facilities",
    image: {
      src: "/illustrations/minnesota-how-to-check.png",
      alt: "Illustrated snowy windowsill with a folded blanket, a ceramic mug, and a pine sprig — standing in for looking up a Minnesota inspection record",
    },
    answer:
      "Search the home on the Minnesota Department of Health provider directory and open its inspection record. On a StarlynnCare profile the red tag is an immediate-jeopardy flag. Read the newest inspection first.",
    faq: [
      {
        q: "Where are Minnesota assisted living inspection records?",
        a: "In the Minnesota Department of Health provider directory. Search the home and open its record. The StarlynnCare page for the home links to that record when we stored a link.",
      },
      {
        q: "What does the red tag on a Minnesota profile mean?",
        a: "An immediate-jeopardy flag. The count of homes with a serious citation on /data is wider: it also includes a finding stored at severity 3 or higher.",
      },
      CLEAN_RECORD,
    ],
  },
};
