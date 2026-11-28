/**
 * PR A accuracy: Oregon phones, Washington inspection vs complaint,
 * California window counts and Type A/B labels, compliance-banner link text.
 * Counts come from these fixtures. Nothing here is a live database total.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ComplianceFlagBanner } from "../src/components/facility/ComplianceFlag.tsx";
import { FacilityQuickFacts } from "../src/components/facility/profile/FacilityQuickFacts.tsx";
import { chunkIds, loadLatestInspectionDates } from "../src/lib/data/inspectionDates.ts";
import {
  caTypeDistributionSentence,
  countsCoverProfileWindow,
  selectMostRecentSevereFinding,
} from "../src/lib/facility/citationWindow.ts";
import type { FacilityProfile } from "../src/lib/facility/loadFacilityProfile.ts";
import { missingPhoneRecordLabel, parsePhone } from "../src/lib/facility/phone.ts";
import { linkableFacilityUrl } from "../src/lib/facility/aggregatorLink.ts";
import { summarizeHomeCost } from "../src/lib/cost/costBand.ts";
import { regulatorPublishesSeverityScale } from "../src/lib/states/severityScale.ts";
import {
  inspectionDatePrecision,
  resolveProfileVisits,
} from "../src/lib/facility/inspectionPrecision.ts";
import { formatRecordDate } from "../src/lib/format/formatRecordDate.ts";
import {
  buildFacilityDescription,
  buildFacilityRecordSentence,
  buildFacilitySnippet,
  buildFacilityTitle,
} from "../src/lib/seo/meta.ts";
import { buildFacilityFaqPairs, buildLocalBusinessForFacility, regulatorLicensePageFor } from "../src/lib/seo/schema.ts";
import { caFormatSeverityTag } from "../src/lib/states/CA/severity.ts";
import { stateFromCode } from "../src/lib/states.ts";
import type { Deficiency, Facility } from "../src/lib/types.ts";

const TODAY = "2026-11-27";
const BANNED_CA = /Immediate Jeopardy|\bIJ\b|\bSev(erity)? ?4\b|CMS [A-L]\b/;

function def(partial: Partial<Deficiency>): Deficiency {
  return {
    id: "d1",
    inspection_id: "i1",
    class: null,
    code: null,
    severity: null,
    scope: null,
    scope_severity_code: null,
    immediate_jeopardy: false,
    description: null,
    inspector_narrative: null,
    ...partial,
  } as Deficiency;
}

function assertCaLabel(label: string | undefined) {
  assert.ok(label);
  assert.doesNotMatch(label, BANNED_CA);
}

const typeA = caFormatSeverityTag(
  def({ class: "Type A", immediate_jeopardy: true, severity: 4 }),
);
assert.equal(typeA?.label, "Type A");
assertCaLabel(typeA?.label);

const typeB = caFormatSeverityTag(def({ class: "Type B", immediate_jeopardy: true }));
assert.equal(typeB?.label, "Type B");
assertCaLabel(typeB?.label);

const typeACms = caFormatSeverityTag(
  def({ class: "Type A", scope_severity_code: "J", immediate_jeopardy: true }),
);
assert.equal(typeACms?.label, "Type A");
assertCaLabel(typeACms?.label);

const severeMap = new Map([
  [
    "b-only",
    [{ class: "Type B", immediate_jeopardy: true, severity: 4 }],
  ],
]);
assert.equal(
  selectMostRecentSevereFinding({
    stateCode: "CA",
    inspections: [{ id: "b-only", inspection_date: "2026-09-08" }],
    deficienciesByInspection: severeMap,
    today: TODAY,
  }),
  null,
);
const withTypeA = selectMostRecentSevereFinding({
  stateCode: "CA",
  inspections: [{ id: "a-row", inspection_date: "2026-09-08" }],
  deficienciesByInspection: new Map([
    ["a-row", [{ class: "Type A", immediate_jeopardy: true, severity: 4, code: "87468.1(a)(2)" }]],
  ]),
  today: TODAY,
});
assert.equal(withTypeA?.deficiency.class, "Type A");
assert.equal(
  selectMostRecentSevereFinding({
    stateCode: "WA",
    inspections: [{ id: "b-only", inspection_date: "2026-09-08" }],
    deficienciesByInspection: severeMap,
    today: TODAY,
  })?.deficiency.class,
  "Type B",
);

assert.equal(countsCoverProfileWindow("CA", 0), true);
assert.equal(countsCoverProfileWindow("WA", 0), false);
assert.equal(countsCoverProfileWindow("AZ", 2), true);

const caFaq = buildFacilityFaqPairs({
  facilityName: "Amistad",
  stateName: "California",
  stateCode: "CA",
  pageUrl: "https://www.starlynncare.com/california/corona/amistad",
  inspectionCount: 9,
  deficiencyCount: 8,
  countsCoverThreeYears: countsCoverProfileWindow("CA", 0),
  lastInspectionDate: "2026-04-01",
  lastInspectionType: "annual",
  lastInspectionIsComplaint: false,
  seriousFindings: [{ label: "Type A", count: 8 }],
  percentile: null,
  memoryCareLabel: "CDSS lists a dementia care plan.",
  licenseNumber: "530157",
  licenseUrl: null,
  regulatorName: "California Dept. of Social Services",
  regulatorAbbr: "CDSS",
});
const caCount = caFaq.find((pair) => pair.q.startsWith("How many"));
assert.match(caCount?.a ?? "", /in the last three years/);
assert.match(caCount?.a ?? "", /8 deficiencies across 9 inspections/);
assert.match(caCount?.a ?? "", /tagged Type A/);

const moFaq = buildFacilityFaqPairs({
  facilityName: "Control Home",
  stateName: "Missouri",
  stateCode: "MO",
  pageUrl: "https://www.starlynncare.com/missouri/example",
  inspectionCount: 3,
  deficiencyCount: 2,
  countsCoverThreeYears: countsCoverProfileWindow("MO", 0),
  lastInspectionDate: null,
  lastInspectionType: null,
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "DHSS lists this home.",
  licenseNumber: "123",
  licenseUrl: null,
  regulatorName: "Missouri Dept. of Health and Senior Services",
  regulatorAbbr: "DHSS",
});
assert.equal(
  moFaq.find((pair) => pair.q.startsWith("How many"))?.a,
  "Control Home has 2 deficiencies across 3 inspections.",
);
assert.doesNotMatch(moFaq.find((pair) => pair.q.startsWith("How many"))?.a ?? "", /severe|serious finding/i);

const paFaq = buildFacilityFaqPairs({
  facilityName: "Elm Terrace Gardens",
  stateName: "Pennsylvania",
  stateCode: "PA",
  pageUrl: "https://www.starlynncare.com/pennsylvania/lansdale/elm-terrace-gardens-127830",
  inspectionCount: 4,
  deficiencyCount: 2,
  countsCoverThreeYears: true,
  lastInspectionDate: null,
  lastInspectionType: null,
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "PA DHS lists this home.",
  licenseNumber: "127830",
  licenseUrl: null,
  regulatorName: "Pennsylvania Department of Human Services",
  regulatorAbbr: "PA DHS",
});
const paCount = paFaq.find((pair) => pair.q.startsWith("How many"))?.a ?? "";
assert.equal(paCount.includes("severe"), false);
assert.equal(paCount.includes("None are tagged"), false);
assert.match(paCount, /2 deficiencies across 4 inspections/);
assert.equal(moFaq.some((pair) => /complaint investigation/i.test(pair.q)), false);

function waRow(date: string, complaint: boolean) {
  return {
    inspection_date: date,
    inspection_type: complaint ? "complaint" : "standard",
    is_complaint: complaint,
    datePrecision: inspectionDatePrecision({
      inspection_date: date,
      raw_data: { washington: true },
    }),
  };
}

const ballard = resolveProfileVisits({
  stateCode: "WA",
  inspections: [waRow("2025-05-01", true), waRow("2025-04-01", false)],
  waPostedReport: null,
  derivedLastInspection: "2025-05-01",
});
assert.equal(ballard.latestInspection?.date, "2025-04-01");
assert.equal(ballard.latestInspection?.precision, "month");
assert.equal(formatRecordDate(ballard.latestInspection!.date, ballard.latestInspection!.precision), "April 2025");
assert.equal(formatRecordDate(ballard.latestComplaint!.date, ballard.latestComplaint!.precision), "May 2025");

const marysville = resolveProfileVisits({
  stateCode: "WA",
  inspections: [
    {
      inspection_date: "2026-01-16",
      inspection_type: "complaint",
      is_complaint: true,
      datePrecision: inspectionDatePrecision({
        inspection_date: "2026-01-16",
        raw_data: { washington: true },
      }),
    },
  ],
  waPostedReport: { posted_month: "2026-01", doc_type: "investigation" },
  derivedLastInspection: "2026-01-16",
});
assert.equal(marysville.latestInspection, null);
assert.equal(
  formatRecordDate(marysville.latestComplaint!.date, marysville.latestComplaint!.precision),
  "January 16, 2026",
);

const centralia = resolveProfileVisits({
  stateCode: "WA",
  inspections: [waRow("2026-05-01", true)],
  waPostedReport: { posted_month: "2026-07", doc_type: "investigation" },
  derivedLastInspection: "2026-07-01",
});
assert.equal(centralia.latestInspection, null);
assert.equal(formatRecordDate(centralia.latestComplaint!.date, "month"), "July 2026");

const bellevue = resolveProfileVisits({
  stateCode: "WA",
  inspections: [waRow("2025-01-01", true)],
  waPostedReport: { posted_month: "2026-06", doc_type: "inspection" },
  derivedLastInspection: "2026-06-01",
});
assert.equal(formatRecordDate(bellevue.latestInspection!.date, bellevue.latestInspection!.precision), "June 2026");
assert.equal(formatRecordDate(bellevue.latestComplaint!.date, bellevue.latestComplaint!.precision), "January 2025");

const oregonVisit = resolveProfileVisits({
  stateCode: "OR",
  inspections: [waRow("2025-05-01", true)],
  waPostedReport: null,
  derivedLastInspection: "2025-05-01",
});
assert.deepEqual(oregonVisit.latestInspection, oregonVisit.latestVisit);
assert.equal(oregonVisit.latestComplaint, null);

assert.equal(
  inspectionDatePrecision({ inspection_date: "2026-03-01", raw_data: { washington: true } }),
  "month",
);
assert.equal(formatRecordDate("2026-03-01", "month"), "March 2026");
assert.notEqual(formatRecordDate("2026-03-01", "month"), "March 1, 2026");
assert.equal(formatRecordDate("2025-08-19", "day"), "August 19, 2025");

const waFaq = buildFacilityFaqPairs({
  facilityName: "Aegis Living Ballard",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/seattle/aegis-living-ballard-2689",
  inspectionCount: 4,
  deficiencyCount: 2,
  countsCoverThreeYears: false,
  lastInspectionDate: ballard.latestInspection?.date ?? null,
  lastInspectionType: "standard",
  lastInspectionIsComplaint: false,
  lastInspectionPrecision: "month",
  lastComplaintDate: ballard.latestComplaint?.date ?? null,
  lastComplaintPrecision: "month",
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "DSHS lists Memory Care Certified.",
  licenseNumber: "2689",
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
});
const complaintFaq = waFaq.find((pair) => pair.q.startsWith("When was the most recent DSHS complaint"));
assert.match(complaintFaq?.a ?? "", /dated May 2025/);
assert.match(complaintFaq?.a ?? "", /not a routine inspection/);
assert.doesNotMatch(complaintFaq?.a ?? "", /\bbest\b/i);
assert.match(
  waFaq.find((pair) => pair.q.startsWith("When was Aegis"))?.a ?? "",
  /last inspected in April 2025/,
);

function fakeSupabase(
  rows: Array<{ facility_id: string; inspection_date: string; is_complaint?: boolean }>,
): SupabaseClient {
  const query = {
    select() {
      return query;
    },
    in() {
      return query;
    },
    lte() {
      return query;
    },
    not() {
      return query;
    },
    range() {
      return Promise.resolve({ data: rows, error: null });
    },
  };
  return {
    from() {
      return query;
    },
  } as unknown as SupabaseClient;
}

const siblingRows = [
  { facility_id: "home", inspection_date: "2025-05-01", is_complaint: true },
  { facility_id: "home", inspection_date: "2025-04-01", is_complaint: false },
];
function checkSiblingDates(): Promise<void> {
  return loadLatestInspectionDates(fakeSupabase(siblingRows), ["home"]).then((withComplaints) =>
    loadLatestInspectionDates(fakeSupabase(siblingRows), ["home"], { excludeComplaints: true }).then(
      (withoutComplaints) => {
        assert.equal(withComplaints.get("home"), "2025-05-01");
        assert.equal(withoutComplaints.get("home"), "2025-04-01");
      },
    ),
  );
}

const siblingDates = checkSiblingDates();

const chunks = chunkIds(Array.from({ length: 200 }, (_, i) => i));
assert.deepEqual(chunks.map((chunk) => chunk.length), [80, 80, 40]);
assert.equal(chunkIds(Array.from({ length: 120 }, (_, i) => `id${i}`)).length, 2);

for (const raw of ["(503) 688-5080", "503-688-5080", "5036885080", "+1 503 688 5080"]) {
  assert.deepEqual(parsePhone(raw), { display: "(503) 688-5080", tel: "5036885080" });
}
assert.equal(parsePhone("503-252-085"), null);
assert.equal(parsePhone(""), null);
assert.equal(parsePhone(null), null);
assert.equal(missingPhoneRecordLabel("OR"), "Check Oregon DHS record");
assert.equal(
  regulatorLicensePageFor("OR", "50R358"),
  "https://ltclicensing.oregon.gov/Providers/Details/50R358",
);

function factsProfile(input: {
  stateCode: string;
  phone: string | null;
  license: string | null;
}): FacilityProfile {
  return {
    facility: {
      state_code: input.stateCode,
      phone: input.phone,
      license_number: input.license,
      beds: 12,
      co_care_setting: null,
      operator_name: null,
      last_inspection_date: null,
    },
    latestInspection: null,
    latestComplaint: null,
    totals: { lastCitation: null },
  } as FacilityProfile;
}

const fircrest = renderToStaticMarkup(
  createElement(FacilityQuickFacts, {
    profile: factsProfile({
      stateCode: "OR",
      phone: null,
      license: "50R358",
    }),
  }),
);
assert.match(fircrest, /Not on file/);
assert.match(fircrest, /Providers\/Details\/50R358/);
assert.match(fircrest, /Check Oregon DHS record/);
assert.doesNotMatch(fircrest, /tel:/);

const arbor = renderToStaticMarkup(
  createElement(FacilityQuickFacts, {
    profile: factsProfile({
      stateCode: "OR",
      phone: "(503) 688-5080",
      license: "50R369",
    }),
  }),
);
assert.match(arbor, /tel:5036885080/);
assert.match(arbor, /\(503\) 688-5080/);
assert.doesNotMatch(arbor, /Not on file/);

const malformed = renderToStaticMarkup(
  createElement(FacilityQuickFacts, {
    profile: factsProfile({
      stateCode: "OR",
      phone: "503-252-085",
      license: "50M037",
    }),
  }),
);
assert.match(malformed, /Not on file/);
assert.doesNotMatch(malformed, /503-252-085/);

const oregon = stateFromCode("OR");
assert.ok(oregon);
const facilityBase = {
  id: "f",
  state_code: "OR",
  name: "Fircrest Senior Living",
  license_number: "50R358",
  city: "McMinnville",
  city_slug: "mcminnville",
  slug: "fircrest-senior-living-50r358",
  beds: 20,
  care_category: "alf_memory_care",
  serves_memory_care: true,
  publishable: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  capacity_tier: "medium",
  phone: null,
} as Facility;
const noPhoneLd = buildLocalBusinessForFacility(facilityBase, oregon, {
  canonicalUrl: "https://www.starlynncare.com/oregon/mcminnville/fircrest-senior-living-50r358",
}) as { telephone?: string };
assert.equal(noPhoneLd.telephone, undefined);
const badPhoneLd = buildLocalBusinessForFacility(
  { ...facilityBase, phone: "503-252-085" },
  oregon,
  { canonicalUrl: "https://www.starlynncare.com/oregon/mcminnville/firwood" },
) as { telephone?: string };
assert.equal(badPhoneLd.telephone, undefined);
const goodPhoneLd = buildLocalBusinessForFacility(
  { ...facilityBase, phone: "(503) 688-5080", license_number: "50R369", name: "Arbor Senior Living" },
  oregon,
  { canonicalUrl: "https://www.starlynncare.com/oregon/portland/arbor-senior-living-50r369" },
) as { telephone?: string };
assert.equal(goodPhoneLd.telephone, "(503) 688-5080");

const txTitle = buildFacilityTitle({
  name: "Sample Home",
  stateName: "Texas",
  stateCode: "TX",
  percentile: null,
  city: "Houston",
  citationCount: 0,
  inspectionCount: 1,
  reviewCount: 0,
  lastInspectionDate: "2023-02-16",
  licenseLabel: "Assisted Living",
});
assert.equal(txTitle, "Sample Home, Houston — no citations, inspected Feb 2023");
assert.doesNotMatch(txTitle, /0 citations/);
assert.doesNotMatch(txTitle, /clean record/i);

const txSentence = buildFacilityRecordSentence({
  citationCount: 0,
  inspectionCount: 1,
  lastInspected: "Feb 2023",
  regulatorAbbr: "HHSC",
  licenseNumber: "148715",
});
assert.equal(
  txSentence,
  "0 HHSC citations on record in the last 3 years, last inspected Feb 2023, license 148715.",
);
assert.doesNotMatch(txSentence ?? "", /clean record/i);

const txFaq = buildFacilityFaqPairs({
  facilityName: "Sample Home",
  stateName: "Texas",
  stateCode: "TX",
  pageUrl: "https://www.starlynncare.com/texas/houston/sample-home",
  inspectionCount: 1,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: "2023-02-16",
  lastInspectionType: "annual",
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "HHSC lists this home.",
  licenseNumber: "148715",
  licenseUrl: null,
  regulatorName: "Texas Health and Human Services",
  regulatorAbbr: "HHSC",
});
assert.equal(
  txFaq.find((pair) => pair.q.startsWith("Has "))?.a,
  "No. Sample Home has no HHSC citations.",
);
assert.equal(
  txFaq.find((pair) => pair.q.startsWith("How many"))?.a,
  "Sample Home has 0 deficiencies across 1 inspection.",
);
assert.equal(txFaq.some((pair) => /clean record/i.test(pair.a)), false);

const caStrings = [
  caTypeDistributionSentence(9, 7, 0),
  caFaq.map((pair) => pair.a).join("\n"),
  buildFacilityRecordSentence({
    citationCount: 16,
    inspectionCount: 55,
    lastInspected: "Sep 2026",
    regulatorAbbr: "CDSS",
    licenseNumber: "6452",
  }) ?? "",
  buildFacilityDescription({
    name: "Harbor Heights",
    percentile: null,
    stateName: "California",
    stateCode: "CA",
    city: "Anaheim",
    citationCount: 16,
    inspectionCount: 55,
    reviewCount: 0,
    agency: "CDSS",
    lastInspected: "Sep 2026",
  }),
  buildFacilitySnippet({
    facilityName: "Harbor Heights",
    stateName: "California",
    stateCode: "CA",
    grade: null,
    percentile: null,
    citationCount: 16,
    lastInspectionDate: "2026-09-01",
    lastInspected: "Sep 2026",
    variant: "prose",
    regulatorAbbr: "CDSS",
  }),
];
for (const text of caStrings) assert.doesNotMatch(text, BANNED_CA);

const flag = {
  tier: 1 as const,
  banner_text: "See the state record at https://example.com/record for this license.",
  docs: [],
  checked_at: "2026-11-27",
};
const caBanner = renderToStaticMarkup(
  createElement(ComplianceFlagBanner, { flag, placement: "top", stateCode: "CA" }),
);
const waBanner = renderToStaticMarkup(
  createElement(ComplianceFlagBanner, { flag, placement: "top", stateCode: "WA" }),
);
assert.match(caBanner, />CDSS</);
assert.doesNotMatch(caBanner, />DSHS</);
assert.match(waBanner, />DSHS</);

const oakmontProposal =
  "California CDSS Community Care Licensing lists a revocation action as pending for this license (pleading date 2026-09-03). The license status is still Licensed. Source: CDSS facility record (https://www.ccld.dss.ca.gov/carefacilitysearch/?rewrite=FacDetail&facNum=345002797). As of 2026-11-27. This is a state record, not a rating of care quality; families may want to ask the home about it.";
assert.match(oakmontProposal, /pending/);
assert.doesNotMatch(oakmontProposal, /revoked/i);

const loader = readFileSync(new URL("../src/lib/facility/loadFacilityProfile.ts", import.meta.url), "utf8");
assert.equal(loader.includes(".limit(50)"), false);
assert.match(loader, /\.range\(/);

const phoneSrc = readFileSync(new URL("../src/lib/facility/phone.ts", import.meta.url), "utf8");
assert.doesNotMatch(phoneSrc, /\bbest\b/i);
assert.doesNotMatch(phoneSrc, /top-rated/i);
assert.doesNotMatch(phoneSrc, /does not offer memory care/i);
assert.doesNotMatch(phoneSrc, /clean record/i);

assert.equal(linkableFacilityUrl("https://www.senioradvisor.com/local/elm-terrace-gardens-lansdale-pa"), null);
assert.equal(linkableFacilityUrl("https://www.caring.com/senior-living/pennsylvania/lafayette-hill/sunrise-of-lafayette-hill-19444"), null);
assert.equal(linkableFacilityUrl("https://www.aplaceformom.com/community/example"), null);
assert.equal(linkableFacilityUrl("https://www.seniorly.com/example"), null);
assert.equal(linkableFacilityUrl("https://gardenscare.com/scottsdale/"), "https://gardenscare.com/scottsdale/");
assert.equal(linkableFacilityUrl("https://www.sunriseseniorliving.com/communities/pa/lafayette-hill"), "https://www.sunriseseniorliving.com/communities/pa/lafayette-hill");
assert.equal(linkableFacilityUrl(null), null);

const cost = summarizeHomeCost([
  {
    facility_id: "home",
    source: "senioradvisor",
    source_url: "https://www.senioradvisor.com/local/elm-terrace-gardens-lansdale-pa",
    fetched_at: "2026-11-01",
    entry_price: 4500,
    memory_care_price: null,
    care_basis: "assisted_living",
  },
]);
assert.equal(cost?.sources[0]?.label, "SeniorAdvisor");
assert.equal(cost?.sources[0]?.url, null);

const ownSite = buildLocalBusinessForFacility(
  { ...facilityBase, phone: null, website: "https://www.sunriseseniorliving.com/example" } as unknown as Facility,
  stateFromCode("PA")!,
  { canonicalUrl: "https://www.starlynncare.com/pennsylvania/lafayette-hill/sunrise" },
) as { sameAs?: string[] };
assert.equal(ownSite.sameAs?.includes("https://www.sunriseseniorliving.com/example"), true);
const aggregatorSite = buildLocalBusinessForFacility(
  { ...facilityBase, phone: null, website: "https://www.caring.com/senior-living/example" } as unknown as Facility,
  stateFromCode("PA")!,
  { canonicalUrl: "https://www.starlynncare.com/pennsylvania/lafayette-hill/sunrise" },
) as { sameAs?: string[] };
assert.equal(aggregatorSite.sameAs?.some((url) => url.includes("caring.com")), false);

assert.equal(regulatorPublishesSeverityScale("CA"), true);
assert.equal(regulatorPublishesSeverityScale("IL"), true);
assert.equal(regulatorPublishesSeverityScale("OR"), true);
assert.equal(regulatorPublishesSeverityScale("CO"), true);
assert.equal(regulatorPublishesSeverityScale("WA", "cms"), true);
assert.equal(regulatorPublishesSeverityScale("WA"), false);
assert.equal(regulatorPublishesSeverityScale("PA"), false);
assert.equal(regulatorPublishesSeverityScale("AZ"), false);
assert.equal(regulatorPublishesSeverityScale("MN"), false);
assert.equal(regulatorPublishesSeverityScale("MO"), false);
assert.equal(regulatorPublishesSeverityScale("TX"), false);
assert.equal(regulatorPublishesSeverityScale("UT"), false);

siblingDates
  .then(() => {
    console.log("test_pr_a_accuracy: ok");
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
