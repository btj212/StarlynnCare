import assert from "node:assert/strict";
import {
  buildFacilityDescription,
  buildFacilityDirectAnswer,
  buildFacilityRecordSentence,
  buildFacilityReportsTitle,
  buildFacilitySnippet,
  buildFacilityTitle,
  buildStateHubTitle,
} from "../src/lib/seo/meta.ts";
import { buildFacilityFaqPairs } from "../src/lib/seo/schema.ts";
import { displayCityName } from "../src/lib/resolveListingRegion.ts";

const longName = "The Heritage at Brookdale Tanque Verde Estates";

const titled = buildFacilityTitle({
  name: "Brookdale Tanque Verde",
  stateName: "Arizona",
  percentile: 82,
  city: "Tucson",
  citationCount: 5,
  inspectionCount: 4,
  reviewCount: 0,
  lastInspectionDate: "2024-09-12",
});
assert.equal(titled, "Brookdale Tanque Verde, Tucson — 5 citations, inspected Sep 2024");
assert.equal(titled.includes("Top"), false);
assert.ok(titled.length <= 70);
assert.equal(titled.includes("Inspection Record & Citations"), false);

const withReviews = buildFacilityTitle({
  name: "Short Home",
  stateName: "Arizona",
  percentile: 10,
  city: "Mesa",
  citationCount: 1,
  inspectionCount: 2,
  reviewCount: 3,
  lastInspectionDate: "2025-03-01",
});
assert.equal(withReviews, "Short Home, Mesa — 1 citation, inspected Mar 2025");
assert.equal(withReviews.includes("Top"), false);
assert.ok(withReviews.length <= 70);

const noRecord = buildFacilityTitle({
  name: "Quiet Cottage",
  stateName: "Oregon",
  percentile: null,
  city: "Portland",
  citationCount: 0,
  inspectionCount: 0,
  reviewCount: 0,
});
assert.equal(noRecord, "Quiet Cottage, Portland: Licensed Memory Care");

const clipped = buildFacilityTitle({
  name: longName,
  stateName: "Arizona",
  percentile: 90,
  city: "Tucson",
  citationCount: 12,
  inspectionCount: 8,
  reviewCount: 4,
  lastInspectionDate: "2024-01-01",
});
assert.equal(clipped.startsWith("The Heritage at Brookdale"), true);
assert.ok(clipped.length <= 70);
assert.equal(clipped.includes("Top"), false);

const sentence = buildFacilityRecordSentence({
  citationCount: 5,
  inspectionCount: 4,
  lastInspected: "Sep 2024",
  regulatorAbbr: "ADHS",
  licenseNumber: "AL11370C",
});
assert.equal(
  sentence,
  "5 ADHS citations on record in the last 3 years, last inspected Sep 2024, license AL11370C.",
);

const none = buildFacilityRecordSentence({
  citationCount: 0,
  inspectionCount: 0,
  lastInspected: null,
  regulatorAbbr: "ADHS",
  licenseNumber: null,
});
assert.equal(none, null);

const desc = buildFacilityDescription({
  name: "Quiet Cottage",
  percentile: 20,
  stateName: "Oregon",
  city: "Portland",
  citationCount: 0,
  inspectionCount: 0,
  reviewCount: 0,
  agency: "OR DHS",
  lastInspected: null,
});
assert.equal(/review/i.test(desc), false);
assert.match(desc, /no OR DHS inspection on record/);

const answer = buildFacilityDirectAnswer({
  name: "Brookdale Tanque Verde",
  city: "Tucson",
  stateName: "Arizona",
  regulatorAbbr: "ADHS",
  licenseNumber: "AL11370C",
  inspectionCount: 4,
  citationCount: 5,
  lastInspected: "Sep 2024",
  beds: 64,
});
assert.ok(answer);
const words = answer.trim().split(/\s+/).length;
assert.ok(words >= 40 && words <= 70, `direct answer was ${words} words: ${answer}`);
assert.match(answer, /Brookdale Tanque Verde/);
assert.match(answer, /Tucson/);
assert.match(answer, /Directed Care licensed home/);
assert.doesNotMatch(answer, /licensed memory care home/);

assert.equal(
  buildStateHubTitle("Pennsylvania", "PA DHS"),
  "Pennsylvania Memory Care Inspection Reports | PA DHS Lookup",
);
assert.equal(
  buildStateHubTitle("Pennsylvania", "PA DHS", "PA"),
  "Pennsylvania Personal Care Home License Search | PA DHS",
);

const reportsTitle = buildFacilityReportsTitle({
  name: "Brookdale Tanque Verde",
  stateName: "Arizona",
  city: "Tucson",
});
assert.equal(reportsTitle, "Brookdale Tanque Verde, Tucson: Full AZ inspection reports");
assert.notEqual(reportsTitle, titled);
assert.match(reportsTitle, /inspection reports/i);
assert.doesNotMatch(reportsTitle, /inspected Sep 2024/);

const faq = buildFacilityFaqPairs({
  facilityName: "Brookdale Tanque Verde",
  stateName: "Arizona",
  stateCode: "AZ",
  pageUrl: "https://www.starlynncare.com/arizona/tucson/brookdale-tanque-verde",
  inspectionCount: 4,
  deficiencyCount: 5,
  countsCoverThreeYears: true,
  lastInspectionDate: "2024-09-12",
  lastInspectionType: "annual",
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "ADHS lists a directed care service.",
  licenseNumber: "AL11370C",
  licenseUrl: null,
  regulatorName: "Arizona Department of Health Services",
  regulatorAbbr: "ADHS",
});
const cited = faq.find((pair) => pair.q === "Has Brookdale Tanque Verde been cited by ADHS?");
const counted = faq.find((pair) => pair.q.startsWith("How many"));
assert.ok(cited);
assert.match(cited.a, /5 deficiencies from ADHS in the last three years/);
assert.match(counted?.a ?? "", /5 deficiencies/);
assert.equal(cited.a.includes("all time"), false);

const monthOnlySnippet = buildFacilitySnippet({
  facilityName: "Ciel Senior Living",
  stateName: "Washington",
  stateCode: "WA",
  grade: null,
  percentile: null,
  citationCount: 2,
  lastInspectionDate: "2024-09-01",
  lastInspected: "June 2026",
  variant: "prose",
  regulatorAbbr: "DSHS",
});
assert.match(monthOnlySnippet, /last inspected June 2026/);
assert.doesNotMatch(monthOnlySnippet, /Sep 2024/);

assert.equal(displayCityName("PORTLAND", "portland"), "Portland");
assert.equal(displayCityName("Tucson", "tucson"), "Tucson");
assert.equal(displayCityName("ST. LOUIS", "st-louis"), "St. Louis");

console.log("facility SERP checks passed");
