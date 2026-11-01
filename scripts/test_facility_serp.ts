import assert from "node:assert/strict";
import {
  buildFacilityDescription,
  buildFacilityRecordSentence,
  buildFacilityTitle,
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
});
assert.equal(titled.startsWith("Brookdale Tanque Verde, Tucson, AZ"), true);
assert.equal(titled.includes("Top"), false);
assert.equal(/review/i.test(titled), false);
assert.ok(titled.length <= 60);

const withReviews = buildFacilityTitle({
  name: "Short Home",
  stateName: "Arizona",
  percentile: 10,
  city: "Mesa",
  citationCount: 1,
  inspectionCount: 2,
  reviewCount: 3,
});
assert.match(withReviews, /Short Home, Mesa, AZ/);
assert.match(withReviews, /reviews/);
assert.equal(withReviews.includes("Top"), false);
assert.ok(withReviews.length <= 60);

const noRecord = buildFacilityTitle({
  name: "Quiet Cottage",
  stateName: "Oregon",
  percentile: null,
  city: "Portland",
  citationCount: 0,
  inspectionCount: 0,
  reviewCount: 0,
});
assert.equal(noRecord, "Quiet Cottage, Portland, OR");
assert.equal(/inspection|citation|review/i.test(noRecord), false);

const clipped = buildFacilityTitle({
  name: longName,
  stateName: "Arizona",
  percentile: 90,
  city: "Tucson",
  citationCount: 12,
  inspectionCount: 8,
  reviewCount: 4,
});
assert.equal(clipped.startsWith("The Heritage at Brookdale"), true);
assert.ok(clipped.length <= 60);
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
  "5 ADHS citations on record, last inspected Sep 2024, license AL11370C.",
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

assert.equal(displayCityName("PORTLAND", "portland"), "Portland");
assert.equal(displayCityName("Tucson", "tucson"), "Tucson");
assert.equal(displayCityName("ST. LOUIS", "st-louis"), "St. Louis");

console.log("facility SERP checks passed");
