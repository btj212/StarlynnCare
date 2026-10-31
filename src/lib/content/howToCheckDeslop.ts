import type { DeslopSection } from "@/lib/content/reviewArticles";

function passes(heading: string, first: [string, string, string], second: [string, string, string]): DeslopSection {
  return {
    heading,
    passes: [
      { before: first[0], after: first[1], cut: first[2] },
      { before: second[0], after: second[1], cut: second[2] },
    ],
  };
}

const SHARED_SECTIONS: DeslopSection[] = [
  passes(
    "What should I read in a report?",
    [
      "Reading an inspection report can feel daunting, but focusing on a few key red flags will reveal everything you need to know.",
      "The date. Whether the visit followed a complaint. The rule cited and the inspector's description of what happened.",
      "feel daunting, key red flags, reveal everything you need to know",
    ],
    [
      "Pay close attention to the severity label, which tells you how dangerous the home is.",
      "The severity label the state used. The next section says what that label means on a profile here. Whether a later inspection found the same problem again.",
      "pay close attention, how dangerous the home is",
    ],
  ),
  passes(
    "What records do we hold? (inspection window)",
    [
      "Our robust dataset captures every inspection and complaint the state has ever recorded.",
      "Since the cutoff date, we hold this many inspections of published homes. This many followed a complaint.",
      "robust dataset, captures every, ever recorded",
    ],
    [
      "Since the cutoff date, we hold this many inspections of published homes. Zero followed a complaint.",
      "When a state's files carry no complaint flag at all, the page says the files do not mark complaints, instead of printing zero.",
      "printing zero for a flag the files do not carry",
    ],
  ),
  passes(
    "What should I ask the home?",
    [
      "Arm yourself with these essential questions to hold the home accountable.",
      "Ask about each finding from the last 24 months, and what the home changed afterward.",
      "arm yourself, essential, hold the home accountable",
    ],
    [
      "Make sure the home is fully transparent about any ongoing issues and shares its paperwork.",
      "Ask whether any complaint investigation is still open. Ask to see the most recent inspection report the home received.",
      "fully transparent, ongoing issues, shares its paperwork",
    ],
  ),
  passes(
    "Common questions",
    [
      "A spotless inspection history is the best guarantee of a safe, high-quality home.",
      "No. An inspection records what the state found on the day it looked.",
      "spotless, best guarantee, safe, high-quality",
    ],
    [
      "No. An inspection records what the state found on the day it looked, so do your due diligence.",
      "No. An inspection records what the state found on the day it looked. Read the newest report, check whether later visits followed a complaint, and visit the home yourself.",
      "do your due diligence",
    ],
  ),
];

export const ARIZONA_HOW_TO_DESLOP: DeslopSection[] = [
  passes(
    "Where to look",
    [
      "AZ Care Check is a seamless, user-friendly portal that makes it easy to uncover a community's true inspection story.",
      "Open AZ Care Check and search the home's name. The inspection record on that site is the original.",
      "seamless, user-friendly, uncover, true inspection story",
    ],
    [
      "Open AZ Care Check and search the home's name in order to operationalize record retrieval.",
      "Open AZ Care Check and search the home's name. The inspection record on that site is the original. This directory's page for the home links to it when we stored a link.",
      "operationalize record retrieval",
    ],
  ),
  passes(
    "What the red tag means",
    [
      "Immediate jeopardy is basically the only citation that matters, and high risk is just as bad.",
      "On an Arizona profile, the red tag is immediate jeopardy. High risk and enforcement are not that label.",
      "basically the only citation that matters, just as bad",
    ],
    [
      "The serious-citation metric encompasses severity integers of three or above, which stakeholders should contextualize against the red-tag taxonomy.",
      "The count of homes with a serious citation still includes a finding stored at severity 3 or higher.",
      "metric, severity integers, stakeholders, contextualize, taxonomy",
    ],
  ),
  passes(
    "Opening answer",
    [
      "Checking an Arizona memory care home's track record is easier than you might think, thanks to the state's helpful online tools.",
      "Search the home's name on AZ Care Check, the Arizona Department of Health Services site, and open its inspection reports.",
      "easier than you might think, helpful online tools",
    ],
    [
      "Search the home's name on AZ Care Check and open its inspection reports. Our page shows the full history.",
      "Read the newest report first, then any visit that followed a complaint. The StarlynnCare page for the home lists the inspections we hold from the last three years.",
      "the full history",
    ],
  ),
  passes(
    "Directed Care and memory care",
    [
      "A Directed Care license proves an Arizona home is a true memory care specialist.",
      "ADHS told us in a June 2026 public records response that homes licensed for directed care services are automatically authorized for memory care services.",
      "proves, true memory care specialist",
    ],
    [
      "ADHS told us that homes licensed for directed care services are automatically authorized for memory care services, which signals quality.",
      "The license level is not an inspection result.",
      "which signals quality",
    ],
  ),
  ...SHARED_SECTIONS,
];

export const CALIFORNIA_HOW_TO_DESLOP: DeslopSection[] = [
  passes(
    "Where to look",
    [
      "The CDSS portal is the gold standard families should trust for a complete picture of care quality.",
      "Open the CDSS care facility search and search the home's name or facility number.",
      "gold standard, complete picture of care quality",
    ],
    [
      "Open the CDSS care facility search and search the home's name or facility number. Our pages always deep-link the regulator.",
      "The record on that site is the original. This directory's page for the home links to it when we stored a link.",
      "always deep-link",
    ],
  ),
  passes(
    "What the red tag means",
    [
      "Type A is the scary one and Type B is basically fine, so families can ignore Type B.",
      "On a California profile, the red tag is Type A or immediate jeopardy. Type B is not that tag.",
      "scary, basically fine, ignore Type B",
    ],
    [
      "Type A denotes actual or imminent harm pursuant to the deficiency class taxonomy.",
      "On a California profile, the red tag is Type A or immediate jeopardy. Type B is not that tag.",
      "denotes, pursuant to, taxonomy",
    ],
  ),
  passes(
    "Opening answer",
    [
      "California boasts one of the nation's most rigorous inspection systems, giving families unparalleled insight.",
      "Search the home's name or facility number on the CDSS care facility search and open its reports.",
      "boasts, most rigorous, unparalleled insight",
    ],
    [
      "California inspects homes regularly, so the record is always current.",
      "California must inspect every residential care facility for the elderly at least once a year, unannounced. Read the newest report first, and look for Type A citations.",
      "regularly, always current",
    ],
  ),
  passes(
    "CDSS search and statute",
    [
      "The CDSS search contains a facility's complete history.",
      "CDSS says the search holds five years of facility information. For older records, call the regional office listed on the facility's page.",
      "complete history",
    ],
    [
      "Homes must quickly fix any problem inspectors find.",
      "The home must fix a deficiency within 10 days of notice, unless the plan of correction sets a different date.",
      "quickly, any problem",
    ],
  ),
  ...SHARED_SECTIONS,
];

export const PENNSYLVANIA_HOW_TO_DESLOP: DeslopSection[] = [
  passes(
    "Where to look",
    [
      "Pennsylvania's Department of Health publishes an easy dashboard of memory care grades.",
      "Open the Pennsylvania human services provider directory and search the home's name. The office is the Department of Human Services, not the Department of Health.",
      "Department of Health, easy dashboard, grades",
    ],
    [
      "Utilize the human services provider directory to initiate a facility-level records query.",
      "Open the Pennsylvania human services provider directory and search the home's name.",
      "utilize, initiate, facility-level records query",
    ],
  ),
  passes(
    "What the red tag means",
    [
      "Anything with a penalty is a serious citation, including a civil money penalty.",
      "On a Pennsylvania profile, immediate jeopardy, revocation, substantiated abuse, and a provisional license are red tags. A civil money penalty is not a red tag.",
      "anything with a penalty",
    ],
    [
      "Red-tag severity comprises immediate jeopardy, revocation, substantiated abuse, and provisional licensure. A civil money penalty is categorically excluded from the danger tone.",
      "On a Pennsylvania profile, immediate jeopardy, revocation, substantiated abuse, and a provisional license are red tags. A civil money penalty is not a red tag.",
      "comprises, categorically excluded, danger tone",
    ],
  ),
  passes(
    "Opening answer",
    [
      "Pennsylvania's Department of Health makes it simple to review any memory care home's record.",
      "Search the home's name in the Department of Human Services provider directory and open its inspection results.",
      "Department of Health (wrong office), simple, any",
    ],
    [
      "Search the home's name in the Department of Human Services provider directory and open its inspection results.",
      "Personal care homes and assisted living residences are licensed by DHS, not the Department of Health. Read the newest inspection first.",
      "(named the office that does not license these homes, since families confuse the two)",
    ],
  ),
  passes(
    "Directory search tips",
    [
      "A few quick tricks will help you breeze through the directory.",
      "Choose the Office of Long-Term Living as the program office, and type at least four characters of the home's name.",
      "quick tricks, breeze through",
    ],
    [
      "The directory is always current.",
      "DHS says the directory refreshes daily.",
      "always current",
    ],
  ),
  ...SHARED_SECTIONS,
];

export const WASHINGTON_HOW_TO_DESLOP: DeslopSection[] = [
  passes(
    "Where to look",
    [
      "DSHS makes every inspection obvious, and a dementia contract means the home passed a quality test.",
      "Search the home's name or license number on the DSHS provider lookup. Inspection reports for an assisted living facility are on the ALF reports lookup.",
      "obvious, passed a quality test",
    ],
    [
      "Query the DSHS provider lookup by facility name or license identifier, then retrieve ALF report artifacts from the companion lookup.",
      "Search the home's name or license number on the DSHS provider lookup. Inspection reports for an assisted living facility are on the ALF reports lookup.",
      "query, identifier, artifacts, companion lookup",
    ],
  ),
  passes(
    "What the red tag means",
    [
      "Washington calls serious citations Type A, the same as California.",
      "On a Washington assisted living profile, the red tag is immediate jeopardy.",
      "Type A, the same as California",
    ],
    [
      "The danger tone is limited to an immediate-jeopardy flag, while the home count still includes stored severity of three or higher.",
      "On a Washington assisted living profile, the red tag is immediate jeopardy. The count of homes with a serious citation still includes a finding stored at severity 3 or higher.",
      "danger tone, stored severity of three or higher",
    ],
  ),
  passes(
    "Opening answer",
    [
      "Washington offers families a treasure trove of reports for every memory care home.",
      "Find the home on the DSHS assisted living facility locator and open its ALF Reports page.",
      "treasure trove, every memory care home",
    ],
    [
      "That page has everything you need.",
      "That page lists routine inspections, complaint investigations, enforcement letters, and fire inspections. Read the newest inspection and every investigation since.",
      "everything you need",
    ],
  ),
  passes(
    "ALF Reports page",
    [
      "DSHS inspects homes frequently and posts complete reports right away.",
      "DSHS sorts that page into four kinds of report. Inspections happen at least every 18 months. Posting times vary.",
      "frequently, complete, right away",
    ],
    [
      "Some details may be hidden for unclear reasons.",
      "DSHS may black out information that is confidential or could identify a resident.",
      "hidden for unclear reasons",
    ],
  ),
  ...SHARED_SECTIONS,
];
