/**
 * Batch 3 city-hub checks (Vancouver, Denver, Colorado Springs, Chicago, Seattle titles).
 * Fixtures only. The numbers exist so a regression in the serious-vs-any split,
 * the card total, or the Washington contract chip fails here.
 */
import assert from "node:assert/strict";
import { formatFacilityName } from "../src/lib/facility/displayName.ts";
import { omittedUnrenderedSmallHomes } from "../src/lib/facility/hubPreview.ts";
import { cardCitationLines } from "../src/lib/city-hub/cardCitation.ts";
import { listCareChip } from "../src/lib/city-hub/careSetting.ts";
import {
  cityDirectAnswer,
  cityGlanceStats,
  cityHubH1,
  cityHubMetaDescription,
  cityHubTitle,
} from "../src/lib/city-hub/copy.ts";
import { cityFindingsLead } from "../src/lib/city-hub/findings.ts";
import { hubSizeGroup, listSectionTitle } from "../src/lib/city-hub/licenseLabel.ts";
import {
  isVancouverAreaMemoryCareRow,
  VANCOUVER_AREA_CITY_SLUGS,
} from "../src/lib/city-hub/municipality.ts";
import {
  countHomesWithSeriousFinding,
  isSeriousCityFinding,
  stateHasSeverityInData,
  type CityHubGlance,
} from "../src/lib/city-hub/stats.ts";
import { keepTopRanked } from "../src/lib/city-hub/topRanked.ts";
import { buildCityFaqs } from "../src/lib/content/cityFaqs.ts";
import type { Region } from "../src/lib/regions.ts";

function city(code: string, slug: string, name: string, stateSlug: string, stateName: string): Region {
  return {
    slug,
    name,
    kind: "city",
    citySlugs: [slug],
    state: { code, slug: stateSlug, name: stateName },
  } as Region;
}

function glance(over: Partial<CityHubGlance> = {}): CityHubGlance {
  return {
    listedCount: 6,
    publishableCount: 6,
    excludedCount: 0,
    bedsTotal: 0,
    zipCount: 4,
    withCitation: 5,
    withCitationPct: 83,
    inspectionsLast12: 10,
    citationsLast12: 8,
    citationsPrior12: 0,
    citationsLast36: 20,
    seriousLast12: 0,
    homesWithSeriousLast12: 0,
    typeALast12: 0,
    homesWithTypeALast12: 0,
    newestInspection: "2026-02-03",
    severityMeasured: true,
    size: { lte6: 0, from7to10: 0, gte11: 6 },
    sdcCount: 0,
    pchCount: 0,
    alrCount: 0,
    dementiaLicenseCount: 0,
    ccrcCount: 0,
    topCitedLast12Name: null,
    topCitedLast12Count: 0,
    ...over,
  };
}

const denver = city("CO", "denver", "Denver", "colorado", "Colorado");
const springs = city("CO", "colorado-springs", "Colorado Springs", "colorado", "Colorado");
const chicago = city("IL", "chicago", "Chicago", "illinois", "Illinois");
const vancouver = city("WA", "vancouver", "Vancouver", "washington", "Washington");
const seattle = city("WA", "seattle", "Seattle", "washington", "Washington");

// T1. Five homes have a citation. Only two have a Level C/D/E finding.
const homes = [
  { id: "springbrooke", serious_citations: 1, total_citations: 8 },
  { id: "sunrise", serious_citations: 1, total_citations: 6 },
  { id: "ivy", serious_citations: 0, total_citations: 12 },
  { id: "highpointe", serious_citations: 0, total_citations: 14 },
  { id: "brookdale", serious_citations: 0, total_citations: 3 },
  { id: "clean", serious_citations: 0, total_citations: 0 },
];
assert.equal(isSeriousCityFinding({ class: "C", severity: 3, state_severity_raw: "C" }, "CO"), true);
assert.equal(isSeriousCityFinding({ class: null, severity: null, state_severity_raw: null }, "CO"), false);
assert.equal(countHomesWithSeriousFinding(homes), 2);
const findings = cityFindingsLead({
  stateCode: "CO",
  city: "Denver",
  listedCount: 6,
  anyCitationHomes: 5,
  seriousHomes: 2,
  hubNoun: "memory care facilities",
  findingPhrase: "higher-severity finding",
  citationsLast12: 8,
  severityIsFloor: true,
  regulator: "CDPHE",
});
assert.match(findings, /2 \(33%\) have at least one higher-severity finding on file/);
assert.doesNotMatch(findings, /5 \(83%\) have at least one higher-severity/);
const denverFaqs = buildCityFaqs(denver, {
  totalCount: 6,
  facilitiesWithDeficiency: 5,
  homesWithSerious: 2,
  severityFloor: true,
  regulatorAbbr: "CDPHE",
});
const seriousFaq = denverFaqs.find((pair) => /serious deficiency/i.test(pair.q));
assert.ok(seriousFaq);
assert.match(seriousFaq.a, /2 \(33%\)/);
assert.doesNotMatch(seriousFaq.a, /\b5 \(83%\)/);
assert.match(seriousFaq.a, /this count is a floor/);

// T2. More than half of the window has no class, severity, or raw label.
const unclassified = [
  { class: null, severity: null, state_severity_raw: null },
  { class: null, severity: null, state_severity_raw: null },
  { class: "C", severity: 3, state_severity_raw: "C" },
];
assert.equal(stateHasSeverityInData(unclassified, "CO"), false);
assert.equal(stateHasSeverityInData(unclassified, "OR"), false);
const hiddenSerious = cityGlanceStats(
  denver,
  glance({ severityMeasured: false, citationsLast12: 8, seriousLast12: 0 }),
  "CDPHE",
).map((item) => `${item.n} ${item.label}`).join(" ");
assert.doesNotMatch(hiddenSerious, /0 serious/i);
assert.match(hiddenSerious, /does not grade most citations by severity/);

// T3. The card keeps the all-years total and badges serious separately.
const card = cardCitationLines({ inspections: 4, total_citations: 6, serious_citations: 1 });
assert.match(card.primary, /6 citations/);
assert.equal(card.seriousBadge, "1 serious");
assert.doesNotMatch(card.primary, /1 serious citation on file/);

// T4. Memory Care Certified is not a Specialized Dementia Care contract.
const basis = { kind: "memory-care" as const, label: "Memory care" };
const certifiedOnly = listCareChip({
  stateCode: "WA",
  basis,
  wa_memory_care_certified: true,
  wa_dementia_care_contract: false,
});
assert.equal(certifiedOnly, "Memory Care Certified");
assert.doesNotMatch(certifiedOnly ?? "", /Dementia care contract|Specialized Dementia Care/);
const both = listCareChip({
  stateCode: "WA",
  basis,
  wa_memory_care_certified: true,
  wa_dementia_care_contract: true,
});
assert.match(both ?? "", /Memory Care Certified/);
assert.match(both ?? "", /Specialized Dementia Care contract/);

// T5. The leaving-out number is published rows that are not rendered.
const published = [
  ...Array.from({ length: 18 }, (_, i) => ({ id: `omit-${i}`, beds: 6, capacity_tier: "small" })),
  ...Array.from({ length: 7 }, (_, i) => ({ id: `afh-${i}`, beds: 6, capacity_tier: "small" })),
  ...Array.from({ length: 7 }, (_, i) => ({ id: `alf-${i}`, beds: 40, capacity_tier: "medium" })),
];
const listedIds = new Set([
  ...Array.from({ length: 7 }, (_, i) => `afh-${i}`),
  ...Array.from({ length: 7 }, (_, i) => `alf-${i}`),
]);
assert.equal(omittedUnrenderedSmallHomes(published, listedIds), 18);

// T6. A home the page would mark limited history is not top-ranked.
const ranked = keepTopRanked(
  [{ id: "thin" }, { id: "full" }],
  new Map([["thin", 1], ["full", 4]]),
);
assert.deepEqual(ranked.map((row) => row.id), ["full"]);

// T7. A missing bed count is not the 7–49 group.
assert.equal(hubSizeGroup({ beds: null, capacity_tier: "unknown" }), "unspecified");
assert.notEqual(hubSizeGroup({ beds: null }), "medium");
assert.doesNotMatch(listSectionTitle("illinois", "unspecified"), /7–49/);
assert.match(listSectionTitle("illinois", "medium"), /7–49/);

// T8. The Vancouver area query is the five place slugs, and those rows are not the city N.
const areaRows = [
  { city_slug: "orchards", wa_memory_care_certified: true },
  { city_slug: "salmon-creek", wa_memory_care_certified: true },
  { city_slug: "vancouver", wa_memory_care_certified: true },
  { city_slug: "seattle", wa_memory_care_certified: true },
  { city_slug: "orchards", wa_memory_care_certified: false },
].filter((row) => isVancouverAreaMemoryCareRow(row));
assert.equal(areaRows.length, 2);
assert.ok(areaRows.every((row) => (VANCOUVER_AREA_CITY_SLUGS as readonly string[]).includes(row.city_slug)));
const cityHeadline = 7;
assert.equal(cityHeadline + areaRows.length, 9);
assert.equal(cityHeadline, 7);

// T9. Illinois legal names lose the license suffix and the all-caps casing.
assert.equal(
  formatFacilityName("ST. JOSEPH VILLAGE OF CHICAGO (Assisted Living)"),
  "St. Joseph Village of Chicago",
);
assert.equal(formatFacilityName("ADMIRAL AT THE LAKE (Assisted Lvg)"), "Admiral at the Lake");

// T10. Authored titles, with the current listed counts, stay within 65 characters.
const titles: Array<[Region, number, string]> = [
  [vancouver, 7, "Memory Care Vancouver, WA: DSHS Records & Medicaid Contracts"],
  [denver, 6, "Denver Memory Care Facilities: CDPHE Records for 6 Homes"],
  [springs, 5, "Colorado Springs Memory Care: CDPHE Records for 5 Homes"],
  [chicago, 12, "Chicago Memory Care & Alzheimer's Care: 12 IDPH-Licensed Homes"],
  [seattle, 20, "Memory Care & Dementia Care Homes in Seattle, WA | DSHS Records"],
];
for (const [region, n, expected] of titles) {
  const title = cityHubTitle(region, n);
  assert.equal(title, expected);
  assert.ok(title.length <= 65, title);
}

assert.equal(
  cityHubH1(vancouver, 7),
  "Memory care and dementia care in Vancouver, WA: DSHS inspection records",
);
assert.equal(
  cityHubH1(seattle, 20),
  "Memory care and dementia care homes in Seattle, WA (King County): DSHS records for 20 homes",
);
assert.equal(
  cityHubH1(denver, 6),
  "Memory care facilities in Denver, CO: CDPHE inspection records for 6 homes",
);
assert.equal(
  cityHubH1(springs, 5),
  "Memory care and dementia care in Colorado Springs, CO: CDPHE records for 5 homes",
);
assert.equal(
  cityHubH1(chicago, 12),
  "Memory care and Alzheimer's care in Chicago, IL: IDPH records for 12 homes",
);
assert.equal(
  cityHubMetaDescription({ region: vancouver, listedCount: 7, withCitation: 4, regulatorAbbr: "DSHS" }),
  "Vancouver, WA memory care and dementia care homes with DSHS inspection records, Memory Care Certified status, and which take Medicaid for dementia care.",
);
assert.match(
  cityHubMetaDescription({ region: seattle, listedCount: 20, withCitation: 10, regulatorAbbr: "DSHS" }),
  /^Compare 20 Seattle memory care and dementia care homes/,
);
assert.match(
  cityHubMetaDescription({ region: denver, listedCount: 6, withCitation: 5, regulatorAbbr: "CDPHE" }),
  /^Compare 6 Denver memory care facilities/,
);
assert.match(
  cityHubMetaDescription({ region: springs, listedCount: 5, withCitation: 4, regulatorAbbr: "CDPHE" }),
  /^5 Colorado Springs memory care homes/,
);
assert.match(
  cityHubMetaDescription({ region: chicago, listedCount: 12, withCitation: 8, regulatorAbbr: "IDPH" }),
  /^12 Chicago assisted living homes with a dementia program/,
);

const vancouverAnswer = cityDirectAnswer({
  region: vancouver,
  glance: glance({ listedCount: 7, sdcCount: 1 }),
  regulatorAbbr: "DSHS",
  facts: { cityMemoryCareCertified: 7, areaMemoryCareCount: 6, sdcAcrossLists: 2 },
});
assert.match(vancouverAnswer.a, /DSHS lists 13 Memory Care Certified/);
assert.match(vancouverAnswer.a, /7 inside city limits and 6 in unincorporated Clark County/);
assert.match(vancouverAnswer.a, /2 of them have one in our records/);

const denverAnswer = cityDirectAnswer({
  region: denver,
  glance: glance({ listedCount: 6, citationsLast12: 8 }),
  regulatorAbbr: "CDPHE",
  facts: {
    halfVisit: { count: 6, name: "Springbrooke Senior Living", dateIso: "2026-02-03", windowTotal: 8 },
  },
});
assert.match(denverAnswer.a, /lists 6 Denver homes/);
assert.match(denverAnswer.a, /wrote 8 citations at these homes, 6 of them at one visit to Springbrooke Senior Living on Feb\. 3, 2026/);

const springsAnswer = cityDirectAnswer({
  region: springs,
  glance: glance({ listedCount: 5, withCitation: 4, citationsLast36: 12 }),
  regulatorAbbr: "CDPHE",
  facts: { levelE: { name: "Bear Creek Senior Living", dateIso: "2024-12-10" } },
});
assert.match(springsAnswer.a, /lists 5 Colorado Springs homes/);
assert.match(springsAnswer.a, /4 have CDPHE citations on file, 12 in the last three years/);
assert.match(springsAnswer.a, /immediate-jeopardy \(Level E\) finding at Bear Creek Senior Living in December 2024/);

const chicagoAnswer = cityDirectAnswer({
  region: chicago,
  glance: glance({ listedCount: 12, withCitation: 8, citationsLast36: 37 }),
  regulatorAbbr: "IDPH",
  facts: { thirdHome: { count: 16, name: "Artis Senior Living of Lakeview", windowTotal: 37 } },
});
assert.match(chicagoAnswer.a, /lists 12 Chicago homes/);
assert.match(chicagoAnswer.a, /recorded 37 violations at these homes, 16 of them at Artis Senior Living of Lakeview/);

// T11. A dollar range in the FAQ carries the regional-benchmark label and its source.
for (const region of [chicago, vancouver]) {
  const cost = buildCityFaqs(region, {
    totalCount: region.slug === "chicago" ? 12 : 7,
    facilitiesWithDeficiency: 1,
    homesWithSerious: 1,
  }).find((pair) => /how much does memory care cost/i.test(pair.q));
  assert.ok(cost);
  assert.match(cost.a, /\$/);
  assert.match(cost.a, /regional benchmark, not an? (IDPH|DSHS) figure/);
  assert.match(cost.a, /Genworth 2024/);
}

console.log("city hub batch 3 checks passed");
