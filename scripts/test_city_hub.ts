import assert from "node:assert/strict";
import { formatFacilityName } from "../src/lib/facility/displayName.ts";
import { dedupeHomesByDisplayName } from "../src/lib/city-hub/dedupe.ts";
import {
  belongsOnCityPage,
  displayMunicipality,
} from "../src/lib/city-hub/municipality.ts";
import { cityHubTitle, cityHubH1, cityHubMetaDescription } from "../src/lib/city-hub/copy.ts";
import { findingsCopy } from "../src/lib/city-hub/findings.ts";
import { hasReliable12MonthWindow } from "../src/lib/city-hub/findings.ts";
import { listLicenseLabel, listSectionDeck } from "../src/lib/city-hub/licenseLabel.ts";
import { isSeriousCityFinding } from "../src/lib/city-hub/stats.ts";
import { buildCityFaqs } from "../src/lib/content/cityFaqs.ts";
import { paFormatSeverityTag } from "../src/lib/states/PA/profileConfig.ts";
import type { Region } from "../src/lib/regions.ts";
import type { Deficiency } from "../src/lib/types.ts";

assert.equal(formatFacilityName("CLASS ACT GLENCOVE MESA, LLC"), "Class Act Glencove Mesa, LLC");
assert.equal(formatFacilityName("SUNRISE OF MESA II"), "Sunrise of Mesa II");
assert.equal(formatFacilityName("THE CITADEL ASSISTED LIVING FACILITY"), "The Citadel Assisted Living Facility");
assert.equal(formatFacilityName("PEACEFUL HAVEN ASSISTED LIVING L L C"), "Peaceful Haven Assisted Living LLC");
assert.equal(formatFacilityName("Legacy Retirement Residence"), "Legacy Retirement Residence");
assert.equal(formatFacilityName("GARDENS AT BARRY ROAD, THE"), "The Gardens at Barry Road");
assert.equal(formatFacilityName("Madison Senior Living the"), "The Madison Senior Living");
assert.equal(formatFacilityName("Casa de las Campanas"), "Casa de las Campanas");

const dupes = dedupeHomesByDisplayName([
  { id: "a", name: "Canterbury Place", inspections: 2, total_citations: 1, zip: "15201" },
  { id: "b", name: "CANTERBURY PLACE", inspections: 8, total_citations: 4, zip: "15201" },
  { id: "c", name: "Sunrise of Mesa", inspections: 1, total_citations: 0, zip: "85201" },
  { id: "d", name: "Sunrise of Mesa", inspections: 1, total_citations: 0, zip: "85202" },
]);
assert.equal(dupes.length, 3);
assert.equal(dupes.find((h) => h.zip === "15201")?.id, "b");

assert.deepEqual(
  displayMunicipality({
    stateCode: "PA",
    zip: "15228",
    name: "The Pines of Mt. Lebanon",
    citySlug: "pittsburgh",
  }),
  { slug: "mt-lebanon", name: "Mt. Lebanon" },
);
assert.equal(
  belongsOnCityPage(
    {
      stateCode: "PA",
      zip: "15234",
      name: "Discovery Commons Bethel Park",
      citySlug: "pittsburgh",
    },
    "pittsburgh",
  ),
  false,
);
assert.equal(
  belongsOnCityPage(
    {
      stateCode: "PA",
      zip: "15234",
      name: "Discovery Commons Bethel Park",
      citySlug: "pittsburgh",
    },
    "bethel-park",
  ),
  true,
);

const mesa = {
  slug: "mesa",
  name: "Mesa",
  kind: "city",
  citySlugs: ["mesa"],
  state: { code: "AZ", slug: "arizona", name: "Arizona" },
} as Region;

const title = cityHubTitle(mesa, 145);
assert.match(title, /145/);
assert.doesNotMatch(title, /169/);
assert.ok(title.length <= 60, title);
assert.match(cityHubH1(mesa, 145), /145/);
assert.match(cityHubH1(mesa, 145), /Directed Care/);
const meta = cityHubMetaDescription({
  region: mesa,
  listedCount: 145,
  withCitation: 136,
  homesWithSeriousLast12: 7,
  regulatorAbbr: "ADHS",
});
assert.match(meta, /145/);
assert.match(meta, /Directed Care/);
assert.doesNotMatch(meta, /licensed memory care/);

const paAbuse = paFormatSeverityTag({
  code: "55 Pa Code § 2600.42b",
  severity: 4,
  immediate_jeopardy: true,
  state_severity_raw: "Immediate Jeopardy",
} as Deficiency);
assert.equal(paAbuse?.label, "Substantiated Abuse");

const cmsIj = paFormatSeverityTag({
  code: "F0919",
  severity: 4,
  immediate_jeopardy: true,
  state_severity_raw: "Immediate Jeopardy",
} as Deficiency);
assert.equal(cmsIj?.label, "Immediate Jeopardy (CMS)");

function city(code: string, slug: string, name: string, stateSlug: string, stateName: string): Region {
  return {
    slug,
    name,
    kind: "city",
    citySlugs: [slug],
    state: { code, slug: stateSlug, name: stateName },
  } as Region;
}

const sanDiego = city("CA", "san-diego", "San Diego", "california", "California");
assert.equal(cityHubTitle(sanDiego, 23), "San Diego Memory Care: CA Inspection Records for 23 Homes");
assert.match(cityHubH1(sanDiego, 23), /Memory care in San Diego: California inspection records/);

const stPaul = city("MN", "st-paul", "St. Paul", "minnesota", "Minnesota");
assert.equal(
  cityHubTitle(stPaul, 20, { dementiaLicenseCount: 18 }),
  "St. Paul Memory Care: MDH Records for 18 Dementia Care Homes",
);
assert.match(cityHubH1(stPaul, 20), /Minnesota dementia care licenses/);
assert.match(
  cityHubMetaDescription({
    region: stPaul,
    listedCount: 20,
    withCitation: 7,
    regulatorAbbr: "MDH",
  }),
  /13 of 20/,
);

const kc = city("MO", "kansas-city", "Kansas City", "missouri", "Missouri");
assert.match(cityHubTitle(kc, 19), /Kansas City Memory Care: MO Inspection Records for 19 Homes/);
const kcFaqs = buildCityFaqs(kc, { totalCount: 19, facilitiesWithDeficiency: 18 });
assert.ok(kcFaqs.every((p) => !/Medi-Cal|CDSS|RCFE|Type-A or Type-B deficiency from CDSS/i.test(p.q + p.a)));
assert.ok(kcFaqs.some((p) => /MO HealthNet/i.test(p.q)));
assert.equal(findingsCopy("MO").source.includes("DHSS"), true);
assert.equal(findingsCopy("MN").source.includes("144G"), true);
assert.equal(findingsCopy("OR").source.includes("Oregon DHS"), true);
assert.doesNotMatch(findingsCopy("MN").findingPhrase, /Type-A|Type-B|CDSS/);
assert.doesNotMatch(findingsCopy("OR").findingPhrase, /Type-A|Type-B|CDSS/);
assert.doesNotMatch(findingsCopy("MO").findingPhrase, /Type-A|Type-B|CDSS/);
assert.equal(isSeriousCityFinding({ class: null, severity: 4 }, "OR"), false);
assert.equal(isSeriousCityFinding({ class: "I", severity: 2 }, "MO"), true);
assert.equal(isSeriousCityFinding({ class: "III", severity: 4 }, "MO"), false);
assert.equal(hasReliable12MonthWindow(5), false);
assert.equal(hasReliable12MonthWindow(8), true);

const portland = city("OR", "portland", "Portland", "oregon", "Oregon");
assert.match(cityHubTitle(portland, 17), /Portland Memory Care: Oregon Inspection Records for 17 Homes/);
assert.equal(
  listLicenseLabel({
    stateCode: "OR",
    care_category: "alf_memory_care",
    license_type: "RCF",
  }),
  "RCF",
);
assert.equal(
  listLicenseLabel({
    stateCode: "MO",
    care_category: "alf_general",
    mo_level_of_care: "ALF",
  }),
  "ALF",
);
assert.match(
  listLicenseLabel({
    stateCode: "MN",
    care_category: "alf_memory_care",
    mn_dementia_care_licensed: false,
  }),
  /no dementia care license/i,
);
assert.doesNotMatch(listSectionDeck("minnesota", "medium"), /RCFE/);
assert.doesNotMatch(listSectionDeck("oregon", "medium"), /RCFE/);
assert.doesNotMatch(listSectionDeck("missouri", "medium"), /RCFE/);
assert.match(listSectionDeck("california", "medium"), /RCFE/);

console.log("city hub accuracy checks passed");
