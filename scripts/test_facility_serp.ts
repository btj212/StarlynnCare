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
import { facilityDisplayName } from "../src/lib/facility/aliases.ts";
import { pickNearbyFacilities, type NearbyHome } from "../src/lib/facility/nearbyFacilities.ts";

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
assert.equal(titled.includes("Memory Care"), false);
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
assert.equal(withReviews.includes("Memory Care"), false);
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
assert.equal(noRecord, "Quiet Cottage, Portland — Licensed Care Facility");
assert.equal(/memory care/i.test(noRecord), false);

const licenseFallbacks: Array<{
  name: string;
  city: string;
  stateName: string;
  licenseLabel: string;
  expect: string;
}> = [
  {
    name: "Quiet Cottage",
    city: "Portland",
    stateName: "Oregon",
    licenseLabel: "RCF",
    expect: "Quiet Cottage, Portland — Licensed Residential Care Facility",
  },
  {
    name: "Quiet Cottage",
    city: "Eugene",
    stateName: "Oregon",
    licenseLabel: "ALF",
    expect: "Quiet Cottage, Eugene — Licensed Assisted Living",
  },
  {
    name: "Plain Home",
    city: "Denver",
    stateName: "Colorado",
    licenseLabel: "Assisted living",
    expect: "Plain Home, Denver — Licensed Assisted Living",
  },
  {
    name: "Bo",
    city: "Kent",
    stateName: "California",
    licenseLabel: "RCFE",
    expect: "Bo, Kent — Licensed Residential Care Facility for the Elderly",
  },
  {
    name: "Plain Home",
    city: "Sacramento",
    stateName: "California",
    licenseLabel: "RCFE",
    expect: "Plain Home, Sacramento — Licensed RCFE",
  },
  {
    name: "Plain Home",
    city: "Philadelphia",
    stateName: "Pennsylvania",
    licenseLabel: "Personal care",
    expect: "Plain Home, Philadelphia — Licensed Personal Care",
  },
  {
    name: "Sunrise Memory Care",
    city: "Bend",
    stateName: "Oregon",
    licenseLabel: "Memory Care",
    expect: "Sunrise Memory Care, Bend — Licensed Care Facility",
  },
];
for (const row of licenseFallbacks) {
  const title = buildFacilityTitle({
    name: row.name,
    stateName: row.stateName,
    percentile: null,
    city: row.city,
    citationCount: 0,
    inspectionCount: 0,
    reviewCount: 0,
    licenseLabel: row.licenseLabel,
  });
  assert.equal(title, row.expect);
  assert.ok(title.length <= 70, title);
  assert.equal(/memory care/i.test(title), /memory care/i.test(row.name), title);
}
const namedMc = licenseFallbacks.find((row) => row.name === "Sunrise Memory Care");
assert.ok(namedMc);
assert.equal(/memory care/i.test(namedMc.name), true);

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
assert.equal(clipped.includes("Memory Care"), false);

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

assert.equal(
  faq.some((pair) => /Medicaid|Medi-Cal|secured memory-care/i.test(pair.q)),
  false,
);

const medicaidYes = buildFacilityFaqPairs({
  ...faqInput("Cedar Home", "OR"),
  orAcceptsMedicaid: true,
});
assert.match(
  medicaidYes.find((pair) => pair.q === "Does Cedar Home accept Medicaid?")?.a ?? "",
  /Yes\. Oregon DHS lists Cedar Home as accepting Medicaid/,
);
const medicaidNull = buildFacilityFaqPairs({
  ...faqInput("Cedar Home", "OR"),
  orAcceptsMedicaid: null,
});
assert.equal(medicaidNull.some((pair) => /Medicaid/i.test(pair.q)), false);
const mediCal = buildFacilityFaqPairs(faqInput("Cedar Home", "CA"));
assert.equal(mediCal.some((pair) => /Medi-Cal|Medicaid/i.test(pair.q)), false);

const securedYes = buildFacilityFaqPairs({
  ...faqInput("Mercer Hill at Doylestown", "PA"),
  mcDesignationType: "Secure Dementia Care Unit",
});
assert.match(
  securedYes.find((pair) => /secured memory-care unit/.test(pair.q))?.a ?? "",
  /Secure Dementia Care Unit/,
);
const securedNull = buildFacilityFaqPairs({
  ...faqInput("Mercer Hill at Doylestown", "PA"),
  mcDesignationType: null,
});
assert.equal(securedNull.some((pair) => /secured memory-care unit/.test(pair.q)), false);
const credentialOnly = buildFacilityFaqPairs({
  ...faqInput("Amazing Hearts AFH", "WA"),
  waMemoryCareCertified: null,
});
assert.equal(credentialOnly.some((pair) => /secured memory-care unit/.test(pair.q)), false);
const specialtyIsNotSecured = buildFacilityFaqPairs({
  ...faqInput("Amazing Hearts AFH", "WA"),
  waMemoryCareCertified: null,
  mcDesignationType: null,
});
assert.equal(specialtyIsNotSecured.some((pair) => /secured memory-care unit/.test(pair.q)), false);

assert.equal(
  facilityDisplayName({ name: "LEGACY RETIREMENT RESIDENCE", marketing_name: "Legacy House of Mesa" }),
  "Legacy House of Mesa",
);
assert.equal(facilityDisplayName({ name: "QUIET COTTAGE" }), "Quiet Cottage");

const nearby: NearbyHome[] = [
  { id: "self", name: "Self Home", slug: "self", city_slug: "mesa", city: "Mesa", publishable: true, latitude: "33.4", longitude: "-111.8" },
  { id: "far", name: "Far Home", slug: "far", city_slug: "mesa", city: "Mesa", publishable: true, latitude: "33.9", longitude: "-111.2" },
  { id: "near", name: "Near Home", slug: "near", city_slug: "mesa", city: "Mesa", publishable: true, latitude: "33.41", longitude: "-111.81" },
  { id: "hidden", name: "Hidden Home", slug: "hidden", city_slug: "mesa", city: "Mesa", publishable: false, latitude: "33.40", longitude: "-111.80" },
  { id: "alpha", name: "Alpha Home", slug: "alpha", city_slug: "tucson", city: "Tucson", publishable: true, latitude: "32.2", longitude: "-110.9" },
];
const picked = pickNearbyFacilities({
  selfId: "self",
  citySlug: "mesa",
  latitude: "33.4",
  longitude: "-111.8",
  homes: nearby,
});
assert.deepEqual(picked.map((home) => home.id), ["near", "far", "alpha"]);
assert.equal(picked.some((home) => home.id === "self" || home.id === "hidden"), false);
const alphaOnly = pickNearbyFacilities({
  selfId: "self",
  citySlug: "mesa",
  homes: nearby.map((home) => ({ ...home, latitude: null, longitude: null })),
});
assert.deepEqual(alphaOnly.map((home) => home.id), ["far", "near", "alpha"]);

console.log("facility SERP checks passed");

function faqInput(name: string, stateCode: string) {
  const stateName = stateCode === "OR" ? "Oregon" : stateCode === "CA" ? "California" : stateCode === "PA" ? "Pennsylvania" : "Washington";
  return {
    facilityName: name,
    stateName,
    stateCode,
    pageUrl: "https://www.starlynncare.com/example",
    inspectionCount: 1,
    deficiencyCount: 0,
    countsCoverThreeYears: true,
    lastInspectionDate: "2026-01-01",
    lastInspectionType: "annual",
    lastInspectionIsComplaint: false,
    seriousFindings: [],
    percentile: null,
    memoryCareLabel: null,
    licenseNumber: "1",
    licenseUrl: null,
    regulatorName: "State regulator",
    regulatorAbbr: "DHS",
  };
}
