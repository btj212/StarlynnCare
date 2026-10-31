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
];
