/**
 * Why these checks exist:
 * A window count of zero was printed as "no citations on record" and
 * "None on record" on homes that still have an older deficiency row.
 * Sunrise at Yorba Linda (CA 306002568) is the case: five visits since
 * 2023-11-27 and no citation in that window, and a Type B 87465(a)(9)
 * row on the 2022-10-18 visit. The page also called it a licensed memory
 * care home with no state-file basis, repeated a stale tour date, and
 * said it ranked in the top 1%.
 *
 * Run: npm run test:page-copy
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FacilityQuickFacts } from "../src/components/facility/profile/FacilityQuickFacts";
import type { FacilityProfile } from "../src/lib/facility/loadFacilityProfile";
import { inspectionInProfileWindow } from "../src/lib/facility/citationWindow";
import {
  BASIS_NOT_RECORDED_SENTENCE,
  citationRecordPhrase,
  facilityPageNoun,
  newestCitedDate,
  weightedCitationsPerBedPhrase,
} from "../src/lib/facility/pageCopy";
import { freshenTourQuestions } from "../src/lib/facility/tourQuestions";
import { TEXAS_RECENT_RESULTS } from "../src/lib/facility/texasRecord";
import {
  buildFacilityDescription,
  buildFacilityDirectAnswer,
  buildFacilityRecordSentence,
  buildFacilitySnippet,
  buildFacilityTitle,
} from "../src/lib/seo/meta";
import { buildFacilityFaqPairs, buildLocalBusinessForFacility } from "../src/lib/seo/schema";
import { stateFromCode } from "../src/lib/states";
import type { Facility } from "../src/lib/types";
import { severityRankLine } from "../src/lib/watch/buildWatchWelcomeDigest";

const TODAY = "2026-11-27";

type Visit = {
  id: string;
  date: string;
  complaint: boolean;
  /** Deficiency-row codes. Empty means the visit has no citation row. */
  codes: string[];
};

/** Counts from deficiency rows, the same source the page uses. */
function rowsWeHold(visits: Visit[]) {
  const inWindow = visits.filter((visit) => inspectionInProfileWindow(visit.date, TODAY));
  const cited = visits.filter((visit) => visit.codes.length > 0);
  const last = newestCitedDate(
    [...visits]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .map((visit) => ({ id: visit.id, inspection_date: visit.date })),
    new Set(cited.map((visit) => visit.id)),
  );
  const earliest = [...visits].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? null;
  return {
    windowInspections: inWindow.length,
    windowCitations: inWindow.reduce((sum, visit) => sum + visit.codes.length, 0),
    held: visits.reduce((sum, visit) => sum + visit.codes.length, 0),
    complaintsInWindow: inWindow.filter((visit) => visit.complaint).length,
    olderCitation: visits.some(
      (visit) => visit.codes.length > 0 && !inspectionInProfileWindow(visit.date, TODAY),
    ),
    lastCitationDate: last?.inspection_date ?? null,
    earliest,
  };
}

/** Sunrise at Yorba Linda, license 306002568. The Type B is outside the window. */
const sunriseVisits: Visit[] = [
  { id: "w-2026-07-24", date: "2026-07-24", complaint: true, codes: [] },
  { id: "w-2026-01-05", date: "2026-01-05", complaint: false, codes: [] },
  { id: "w-2025-09-10", date: "2025-09-10", complaint: false, codes: [] },
  { id: "w-2024-09-11", date: "2024-09-11", complaint: false, codes: [] },
  { id: "w-2024-04-03", date: "2024-04-03", complaint: true, codes: [] },
  { id: "old-2022-11-18", date: "2022-11-18", complaint: false, codes: [] },
  { id: "old-2022-10-18", date: "2022-10-18", complaint: true, codes: ["87465(a)(9)"] },
  { id: "old-2022-09-30", date: "2022-09-30", complaint: false, codes: [] },
  { id: "old-2022-06-13", date: "2022-06-13", complaint: false, codes: [] },
  { id: "old-2021-06-13", date: "2021-06-13", complaint: false, codes: [] },
];

const sunrise = rowsWeHold(sunriseVisits);
assert.equal(sunrise.windowInspections, 5);
assert.equal(sunrise.windowCitations, 0);
assert.equal(sunrise.held, 1);
assert.equal(sunrise.complaintsInWindow, 2);
assert.equal(sunrise.olderCitation, true);
assert.equal(sunrise.lastCitationDate, "2022-10-18");
assert.equal(
  newestCitedDate(
    sunriseVisits.map((visit) => ({ id: visit.id, inspection_date: visit.date })),
    new Set(["old-2022-10-18"]),
  )?.id,
  "old-2022-10-18",
  "a newer visit with no deficiency row is not the last citation",
);

const sunriseCite = citationRecordPhrase({
  stateCode: "CA",
  regulatorAbbr: "CDSS",
  windowCount: sunrise.windowCitations,
  inspectionCount: sunrise.windowInspections,
  heldCount: sunrise.held,
  olderCitation: sunrise.olderCitation,
  lastCitationDate: sunrise.lastCitationDate,
  earliestInspectionDate: sunrise.earliest,
});
assert.equal(
  sunriseCite,
  "0 citations in the last 3 years; Last citation Oct 18, 2022",
);

const sunrisePeer = weightedCitationsPerBedPhrase({
  value: 0,
  peerMedian: 0.3,
  agencyShort: "CDSS",
  windowMonths: 36,
});
assert.equal(
  sunrisePeer,
  "Weighted citations per bed: 0.00, against a similar-size peer median of 0.30 (CDSS, 36 months)",
);
assert.equal(
  weightedCitationsPerBedPhrase({ value: 0, peerMedian: null, agencyShort: "CDSS" }),
  null,
);
assert.equal(
  weightedCitationsPerBedPhrase({ value: null, peerMedian: 0.3, agencyShort: "CDSS" }),
  null,
);

const sunriseSnippet = buildFacilitySnippet({
  facilityName: "Sunrise at Yorba Linda",
  stateName: "California",
  stateCode: "CA",
  grade: "A",
  percentile: 100,
  citationCount: sunrise.windowCitations,
  inspectionCount: sunrise.windowInspections,
  heldCount: sunrise.held,
  olderCitation: sunrise.olderCitation,
  lastCitationDate: sunrise.lastCitationDate,
  earliestInspectionDate: sunrise.earliest,
  lastInspectionDate: "2026-07-24",
  lastInspected: "July 24, 2026",
  variant: "prose",
  regulatorAbbr: "CDSS",
  severityValue: 0,
  severityPeerMedian: 0.3,
  windowMonths: 36,
});
assert.match(sunriseSnippet, /0 citations in the last 3 years/);
assert.match(sunriseSnippet, /Last citation Oct 18, 2022/);
assert.match(sunriseSnippet, /last inspected July 24, 2026/);
assert.match(sunriseSnippet, /Weighted citations per bed: 0\.00, against a similar-size peer median of 0\.30 \(CDSS, 36 months\)/);

const sunriseAnswer = buildFacilityDirectAnswer({
  name: "Sunrise at Yorba Linda",
  city: "Yorba Linda",
  stateName: "California",
  stateCode: "CA",
  regulatorAbbr: "CDSS",
  licenseNumber: "306002568",
  inspectionCount: sunrise.windowInspections,
  citationCount: sunrise.windowCitations,
  lastInspected: "July 24, 2026",
  beds: 93,
  basisRecorded: false,
  heldCount: sunrise.held,
  olderCitation: sunrise.olderCitation,
  lastCitationDate: sunrise.lastCitationDate,
  earliestInspectionDate: sunrise.earliest,
});
assert.ok(sunriseAnswer);
assert.match(sunriseAnswer, /state-licensed residential care home for the elderly \(RCFE\)/);
assert.match(sunriseAnswer, new RegExp(BASIS_NOT_RECORDED_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(sunriseAnswer, /licensed memory care home/);
assert.equal(
  facilityPageNoun({ stateCode: "CA", basisRecorded: true }),
  "licensed memory care home",
);

const sunriseRecorded = buildFacilityDirectAnswer({
  name: "Sunrise at Yorba Linda",
  city: "Yorba Linda",
  stateName: "California",
  stateCode: "CA",
  regulatorAbbr: "CDSS",
  licenseNumber: "306002568",
  inspectionCount: sunrise.windowInspections,
  citationCount: sunrise.windowCitations,
  lastInspected: "July 24, 2026",
  beds: 93,
  basisRecorded: true,
  heldCount: sunrise.held,
  olderCitation: sunrise.olderCitation,
  lastCitationDate: sunrise.lastCitationDate,
});
assert.match(sunriseRecorded ?? "", /licensed memory care home/);
assert.doesNotMatch(sunriseRecorded ?? "", /has not yet recorded a memory-care designation/);

const sunriseFaq = buildFacilityFaqPairs({
  facilityName: "Sunrise at Yorba Linda",
  stateName: "California",
  stateCode: "CA",
  pageUrl: "https://www.starlynncare.com/california/yorba-linda/sunrise-at-yorba-linda-2568",
  inspectionCount: sunrise.windowInspections,
  deficiencyCount: sunrise.windowCitations,
  countsCoverThreeYears: true,
  lastInspectionDate: "2026-07-24",
  lastInspectionType: "complaint",
  lastInspectionIsComplaint: true,
  seriousFindings: [],
  percentile: 100,
  severityValue: 0,
  severityPeerMedian: 0.3,
  peerWindowMonths: 36,
  memoryCareLabel: "Memory-care basis not yet recorded from the state file.",
  licenseNumber: "306002568",
  licenseUrl: null,
  regulatorName: "California Department of Social Services",
  regulatorAbbr: "CDSS",
  heldCount: sunrise.held,
  olderCitation: sunrise.olderCitation,
  lastCitationDate: sunrise.lastCitationDate,
  earliestInspectionDate: sunrise.earliest,
});
const sunriseCited = sunriseFaq.find((pair) => pair.q.startsWith("Has "))?.a ?? "";
assert.equal(sunriseCited, "0 citations in the last 3 years; Last citation Oct 18, 2022.");
assert.doesNotMatch(sunriseCited, /^No\./);
assert.match(
  sunriseFaq.find((pair) => pair.q.startsWith("How does"))?.a ?? "",
  /Weighted citations per bed: 0\.00, against a similar-size peer median of 0\.30 \(CDSS, 36 months\)/,
);
assert.match(sunriseFaq.find((pair) => pair.q.startsWith("Does "))?.a ?? "", /not yet recorded/);

const sunriseDesc = buildFacilityDescription({
  name: "Sunrise at Yorba Linda",
  percentile: 100,
  stateName: "California",
  stateCode: "CA",
  city: "Yorba Linda",
  citationCount: sunrise.windowCitations,
  inspectionCount: sunrise.windowInspections,
  agency: "CDSS",
  lastInspected: "July 2026",
  heldCount: sunrise.held,
  olderCitation: sunrise.olderCitation,
  lastCitationDate: sunrise.lastCitationDate,
  earliestInspectionDate: sunrise.earliest,
  basisRecorded: false,
  severityValue: 0,
  severityPeerMedian: 0.3,
  windowMonths: 36,
});

const sunriseFacts = renderToStaticMarkup(
  createElement(FacilityQuickFacts, {
    profile: {
      facility: {
        state_code: "CA",
        phone: null,
        license_number: "306002568",
        beds: 93,
        co_care_setting: null,
        operator_name: null,
        last_inspection_date: "2026-07-24",
      },
      cfg: { agencyShort: "CDSS" },
      latestInspection: { date: "2026-07-24", precision: "day" },
      latestComplaint: null,
      totals: {
        inspections: sunrise.windowInspections,
        deficiencies: sunrise.windowCitations,
        allTimeDeficiencies: sunrise.held,
        olderCitation: true,
        lastCitation: null,
        lastCitationAllTime: "2022-10-18",
        earliestInspectionDate: sunrise.earliest,
      },
    } as FacilityProfile,
  }),
);
assert.match(sunriseFacts, /0 citations in the last 3 years; Last citation Oct 18, 2022/);
assert.doesNotMatch(sunriseFacts, /None on record/);

const caFacility = {
  name: "Sunrise at Yorba Linda",
  city: "Yorba Linda",
  city_slug: "yorba-linda",
  state_code: "CA",
  license_number: "306002568",
  beds: 93,
  phone: null,
  website: null,
  historical_city_slugs: [],
} as Facility;
const sunriseLd = buildLocalBusinessForFacility(caFacility, stateFromCode("CA")!, {
  canonicalUrl: "https://www.starlynncare.com/california/yorba-linda/sunrise-at-yorba-linda-2568",
  extras: {
    citationCount: sunrise.windowCitations,
    inspectionCount: sunrise.windowInspections,
    lastInspectionDate: "2026-07-24",
    regulatorAbbr: "CDSS",
    heldCount: sunrise.held,
    olderCitation: true,
    lastCitationDate: "2022-10-18",
    earliestInspectionDate: sunrise.earliest,
    severityValue: 0,
    severityPeerMedian: 0.3,
    windowMonths: 36,
  },
  memoryCare: {
    recorded: false,
    kind: "none",
    label: "Memory-care basis not yet recorded from the state file.",
    regulator: "California Department of Social Services",
    regulatorShort: "CDSS",
    sourceUrl: null,
    quote: null,
    checkedOn: null,
  },
}) as { description?: string; amenityFeature?: unknown };
assert.match(sunriseLd.description ?? "", /Last citation Oct 18, 2022/);
assert.equal(sunriseLd.amenityFeature, undefined);

const sunriseEmail = severityRankLine(
  {
    metrics: { severity: { value: 0, peer_median: 0.3, percentile: 100 } },
    grade: { composite_percentile: 100 },
    peer_set: { n: 40 },
  },
  "CA",
);
assert.equal(sunriseEmail, sunrisePeer);
assert.equal(
  severityRankLine(
    {
      metrics: { severity: { value: 0, percentile: 100 } },
      grade: { composite_percentile: 100 },
      peer_set: { n: 40 },
    },
    "CA",
  ),
  "",
);

const sunriseTours = freshenTourQuestions(
  [
    "The most recent inspection was on January 5, 2026. What did the inspector find?",
    "Two complaints were filed. How were they resolved?",
    "The home has zero serious citations. How do you keep that up?",
    "CDSS cited section 87705. Can you show the written program?",
    "How are night staff scheduled?",
  ],
  {
    agencyShort: "CDSS",
    stateCode: "CA",
    lastVisitLabel: "July 24, 2026",
    lastVisitIsComplaint: true,
    complaintsInWindow: sunrise.complaintsInWindow,
    windowCitations: sunrise.windowCitations,
    basisRecorded: false,
  },
);
assert.equal(sunriseTours.length, 3);
assert.equal(
  sunriseTours.some((question) => question.includes("January 5, 2026")),
  false,
);
assert.equal(sunriseTours.some((question) => /two complaints/i.test(question)), false);
assert.equal(sunriseTours.some((question) => /zero serious/i.test(question)), false);
assert.equal(sunriseTours.some((question) => question.includes("87705")), false);
assert.ok(
  sunriseTours.includes(
    "CDSS lists 2 complaint investigations in the last 3 years. What changed after them?",
  ),
);

/** Arizona home with inspections and no deficiency rows. */
const azVisits: Visit[] = [
  { id: "az-1", date: "2026-03-01", complaint: false, codes: [] },
  { id: "az-2", date: "2025-03-01", complaint: false, codes: [] },
  { id: "az-3", date: "2024-02-02", complaint: false, codes: [] },
];
const az = rowsWeHold(azVisits);
assert.equal(az.held, 0);
assert.equal(az.windowCitations, 0);
const azCite = citationRecordPhrase({
  stateCode: "AZ",
  regulatorAbbr: "ADHS",
  windowCount: az.windowCitations,
  inspectionCount: az.windowInspections,
  heldCount: az.held,
  olderCitation: az.olderCitation,
  lastCitationDate: az.lastCitationDate,
  earliestInspectionDate: az.earliest,
});
assert.equal(azCite, "No citations in the ADHS records we hold since Feb 2, 2024");
const azAnswer = buildFacilityDirectAnswer({
  name: "Desert Home",
  city: "Mesa",
  stateName: "Arizona",
  stateCode: "AZ",
  regulatorAbbr: "ADHS",
  licenseNumber: "AL10517",
  inspectionCount: az.windowInspections,
  citationCount: 0,
  lastInspected: "March 2026",
  beds: 10,
  basisRecorded: false,
  facilityNoun: "Personal Care Home",
  heldCount: 0,
  earliestInspectionDate: az.earliest,
});
assert.match(azAnswer ?? "", /Personal Care Home/);
assert.doesNotMatch(azAnswer ?? "", /licensed memory care home/);
assert.equal(facilityPageNoun({ stateCode: "AZ", basisRecorded: false }), "licensed home");

/** Minnesota home with window citations and no recorded basis. */
const mnCite = citationRecordPhrase({
  stateCode: "MN",
  regulatorAbbr: "MDH",
  windowCount: 4,
  inspectionCount: 6,
  heldCount: 4,
  olderCitation: false,
  lastCitationDate: "2026-02-20",
});
assert.equal(mnCite, "4 citations in the last 3 years");
assert.equal(mnCite.includes("Last citation"), false);
assert.equal(
  facilityPageNoun({ stateCode: "MN", basisRecorded: false }),
  "state-licensed assisted living home",
);
assert.equal(
  facilityPageNoun({ stateCode: "CO", basisRecorded: false }),
  "state-licensed assisted living home",
);
assert.equal(
  facilityPageNoun({ stateCode: "UT", basisRecorded: false }),
  "state-licensed assisted living home",
);
assert.equal(
  facilityPageNoun({ stateCode: "IL", basisRecorded: false }),
  "state-licensed assisted living home",
);
const mnAnswer = buildFacilityDirectAnswer({
  name: "Ozif Healthcare Services",
  city: "Robbinsdale",
  stateName: "Minnesota",
  stateCode: "MN",
  regulatorAbbr: "MDH",
  licenseNumber: "MN2252",
  inspectionCount: 6,
  citationCount: 4,
  lastInspected: "February 2026",
  beds: 8,
  basisRecorded: false,
});
assert.match(mnAnswer ?? "", /state-licensed assisted living home/);
assert.doesNotMatch(mnAnswer ?? "", /licensed memory care home/);

/** Texas empty window. The published file has no recent result. */
const txSnippet = buildFacilitySnippet({
  facilityName: "Sample Home",
  stateName: "Texas",
  stateCode: "TX",
  grade: null,
  percentile: null,
  citationCount: 0,
  inspectionCount: 0,
  lastInspectionDate: null,
  variant: "prose",
  regulatorAbbr: "HHSC",
});
const txSentence = buildFacilityRecordSentence({
  citationCount: 0,
  inspectionCount: 0,
  lastInspected: null,
  regulatorAbbr: "HHSC",
  licenseNumber: "148715",
  stateCode: "TX",
});
const txDescription = buildFacilityDescription({
  name: "Sample Home",
  percentile: null,
  stateName: "Texas",
  stateCode: "TX",
  city: "Houston",
  citationCount: 0,
  inspectionCount: 0,
  agency: "HHSC",
  lastInspected: null,
});
const txFaq = buildFacilityFaqPairs({
  facilityName: "Sample Home",
  stateName: "Texas",
  stateCode: "TX",
  pageUrl: "https://www.starlynncare.com/texas/houston/sample-home",
  inspectionCount: 0,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: null,
  lastInspectionType: null,
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "HHSC lists this home.",
  licenseNumber: "148715",
  licenseUrl: "https://apps.hhs.texas.gov/LTCSearch/",
  regulatorName: "Texas Health and Human Services",
  regulatorAbbr: "HHSC",
});
const txVisits = buildFacilityRecordSentence({
  citationCount: 0,
  inspectionCount: 2,
  lastInspected: "March 2024",
  regulatorAbbr: "HHSC",
  licenseNumber: null,
  stateCode: "TX",
});
const txCopy = [txSnippet, txSentence, txDescription, txVisits, txFaq.map((pair) => pair.a).join("\n")].join(
  "\n",
);
assert.match(txCopy, new RegExp(TEXAS_RECENT_RESULTS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(txCopy, /has not published a citation count/);
assert.doesNotMatch(txCopy, /0 citations/);
assert.doesNotMatch(txCopy, /clean record/i);
assert.equal(facilityPageNoun({ stateCode: "TX", basisRecorded: false }), "state-licensed assisted living facility");

/** The title names the window. A bare "no citations" is the claim the review caught. */
const quietTitle = buildFacilityTitle({
  name: "Quiet Home",
  stateName: "California",
  stateCode: "CA",
  percentile: null,
  city: "Napa",
  citationCount: 0,
  inspectionCount: 4,
  lastInspectionDate: "2026-07-24",
});
assert.equal(quietTitle, "Quiet Home, Napa — no citations in 3 yrs, inspected Jul 2026");
const txTypeTitle = buildFacilityTitle({
  name: "Sample Home",
  stateName: "Texas",
  stateCode: "TX",
  percentile: null,
  city: "Houston",
  citationCount: 0,
  inspectionCount: 0,
  licenseLabel: "TYPE B",
});
assert.equal(txTypeTitle, "Sample Home, Houston — Licensed Assisted Living");
assert.doesNotMatch(txTypeTitle, /TYPE B/i);
assert.doesNotMatch(txTypeTitle, /0 citations|clean record/i);

/**
 * The "Has this home been cited?" answer uses the same sentence as the page.
 * These four homes have a window of zero and an older deficiency row, so a
 * flat "No" is false.
 */
function citedAnswer(input: {
  name: string;
  stateName: string;
  stateCode: string;
  agency: string;
  windowCount: number;
  inspectionCount: number;
  heldCount: number;
  olderCitation: boolean;
  lastCitationDate: string | null;
  earliestInspectionDate?: string | null;
}): string {
  return (
    buildFacilityFaqPairs({
      facilityName: input.name,
      stateName: input.stateName,
      stateCode: input.stateCode,
      pageUrl: "https://www.starlynncare.com/example",
      inspectionCount: input.inspectionCount,
      deficiencyCount: input.windowCount,
      heldCount: input.heldCount,
      olderCitation: input.olderCitation,
      lastCitationDate: input.lastCitationDate,
      earliestInspectionDate: input.earliestInspectionDate ?? null,
      countsCoverThreeYears: false,
      lastInspectionDate: "2026-01-01",
      lastInspectionType: "annual",
      lastInspectionIsComplaint: false,
      seriousFindings: [],
      percentile: null,
      memoryCareLabel: "listed",
      licenseNumber: "1",
      licenseUrl: null,
      regulatorName: input.agency,
      regulatorAbbr: input.agency,
    }).find((pair) => pair.q.startsWith("Has "))?.a ?? ""
  );
}

const truvalCited = citedAnswer({
  name: "Truval",
  stateName: "Arizona",
  stateCode: "AZ",
  agency: "ADHS",
  windowCount: 0,
  inspectionCount: 3,
  heldCount: 7,
  olderCitation: true,
  lastCitationDate: "2023-11-08",
});
const engelCited = citedAnswer({
  name: "Engel Haus",
  stateName: "Minnesota",
  stateCode: "MN",
  agency: "MDH",
  windowCount: 0,
  inspectionCount: 4,
  heldCount: 5,
  olderCitation: true,
  lastCitationDate: "2023-02-14",
});
const mercysCited = citedAnswer({
  name: "Mercy's Care Home I",
  stateName: "Arizona",
  stateCode: "AZ",
  agency: "ADHS",
  windowCount: 0,
  inspectionCount: 2,
  heldCount: 1,
  olderCitation: true,
  lastCitationDate: "2023-07-03",
});
assert.equal(truvalCited, "0 citations in the last 3 years; Last citation Nov 8, 2023.");
assert.equal(engelCited, "0 citations in the last 3 years; Last citation Feb 14, 2023.");
assert.equal(mercysCited, "0 citations in the last 3 years; Last citation Jul 3, 2023.");
for (const answer of [sunriseCited, truvalCited, engelCited, mercysCited]) {
  assert.doesNotMatch(answer, /^No\./);
  assert.match(answer, /Last citation /);
}
const emptyFileCited = citedAnswer({
  name: "Empty File",
  stateName: "Arizona",
  stateCode: "AZ",
  agency: "ADHS",
  windowCount: 0,
  inspectionCount: 2,
  heldCount: 0,
  olderCitation: false,
  lastCitationDate: null,
  earliestInspectionDate: "2020-01-02",
});
assert.equal(emptyFileCited, "No citations in the ADHS records we hold since Jan 2, 2020.");

const rendered = [
  sunriseCite,
  sunriseSnippet,
  sunriseAnswer ?? "",
  sunriseRecorded ?? "",
  sunriseDesc,
  sunriseFacts,
  sunriseLd.description ?? "",
  sunriseEmail,
  sunriseFaq.map((pair) => `${pair.q} ${pair.a}`).join("\n"),
  sunriseTours.join("\n"),
  azCite,
  azAnswer ?? "",
  mnCite,
  mnAnswer ?? "",
  txCopy,
  quietTitle,
  txTypeTitle,
  truvalCited,
  engelCited,
  mercysCited,
  emptyFileCited,
].join("\n");

assert.doesNotMatch(rendered, /\bon record\b/i);
assert.doesNotMatch(rendered, /None on record/);
assert.doesNotMatch(rendered, /\btop\b/i);
assert.doesNotMatch(rendered, /\bbest\b/i);
assert.doesNotMatch(rendered, /percentile/i);
assert.doesNotMatch(rendered, /\branked\b/i);
assert.doesNotMatch(rendered, /top %/i);
assert.doesNotMatch(rendered, /top-rated/i);
assert.doesNotMatch(rendered, /does not offer memory care/i);

console.log("page copy accuracy: ok");
