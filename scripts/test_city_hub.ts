import assert from "node:assert/strict";
import { formatFacilityName } from "../src/lib/facility/displayName.ts";
import { dedupeHomesByDisplayName } from "../src/lib/city-hub/dedupe.ts";
import {
  belongsOnCityPage,
  displayMunicipality,
} from "../src/lib/city-hub/municipality.ts";
import { cityHubTitle, cityHubH1, cityHubMetaDescription, cityFaqExtras } from "../src/lib/city-hub/copy.ts";
import { cityHubCardGroup, listCareChip, listedInMemoryCareGroup } from "../src/lib/city-hub/careSetting.ts";
import { memoryCareBasis } from "../src/lib/facility/memoryCareBasis.ts";
import type { CityHubGlance } from "../src/lib/city-hub/stats.ts";
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

assert.equal(
  belongsOnCityPage(
    {
      stateCode: "WA",
      zip: "99218",
      name: "Fairwood Northridge",
      citySlug: "fairwood",
      county: "Spokane",
      historicalCitySlugs: ["spokane"],
    },
    "fairwood",
  ),
  false,
);
assert.equal(
  belongsOnCityPage(
    {
      stateCode: "WA",
      zip: "99218",
      name: "Fairwood Northridge",
      citySlug: "fairwood",
      county: "Spokane",
      historicalCitySlugs: ["spokane"],
    },
    "spokane",
  ),
  true,
);
assert.equal(
  belongsOnCityPage(
    {
      stateCode: "WA",
      zip: "98058",
      name: "Fairwood King Home",
      citySlug: "fairwood",
      county: "King",
    },
    "fairwood",
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

const afhBasisNone = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "AFH",
  wa_dementia_specialty: true,
  serves_memory_care: true,
});
assert.equal(
  listCareChip({ stateCode: "WA", basis: afhBasisNone }),
  "Dementia credential",
);
assert.equal(
  listCareChip({
    stateCode: "WA",
    basis: memoryCareBasis({
      state_code: "WA",
      wa_facility_type: "ALF",
      mc_designation_type: "accepts_dementia_no_secured_unit",
      mc_program_quote: "We do have dementia residents.",
    }),
  }),
  "Confirmed: accepts residents with dementia",
);
assert.equal(
  cityHubCardGroup({
    careChip: "Confirmed: accepts residents with dementia",
    capacityTier: "medium",
    inMemoryCareGroup: false,
  }),
  "confirmed-accepts",
);
const mccBasis = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "ALF",
  wa_memory_care_certified: true,
  wa_dementia_specialty: true,
});
assert.equal(listCareChip({ stateCode: "WA", basis: mccBasis }), "Memory Care Certified");
const sdcBasis = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "ALF",
  wa_earc_sdc_contracted: true,
});
assert.equal(
  listCareChip({ stateCode: "WA", basis: sdcBasis }),
  "Specialized Dementia Care contract",
);
const operatorBasis = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "AFH",
  mc_program_confirmed: true,
  mc_program_source_url: "https://example.com/home",
});
assert.equal(
  listCareChip({ stateCode: "WA", basis: operatorBasis }),
  "Memory care program (operator)",
);

assert.equal(
  listedInMemoryCareGroup({
    stateSlug: "washington",
    careChip: null,
    servesMemoryCare: true,
    memoryCareDisclosureFiled: false,
  }),
  false,
);
assert.equal(
  listedInMemoryCareGroup({
    stateSlug: "washington",
    careChip: "Memory Care Certified",
    servesMemoryCare: true,
    memoryCareDisclosureFiled: false,
  }),
  true,
);
assert.equal(
  listedInMemoryCareGroup({
    stateSlug: "washington",
    careChip: "Dementia credential",
    servesMemoryCare: true,
    memoryCareDisclosureFiled: false,
  }),
  false,
);
assert.equal(
  cityHubCardGroup({
    careChip: "Memory Care Certified",
    capacityTier: "large",
    inMemoryCareGroup: true,
  }),
  "memory-care",
);
assert.equal(
  cityHubCardGroup({
    careChip: "Dementia credential",
    capacityTier: "small",
    inMemoryCareGroup: false,
  }),
  "credential",
);
assert.equal(
  cityHubCardGroup({
    careChip: null,
    capacityTier: "medium",
    inMemoryCareGroup: false,
  }),
  "other",
);

const vancouverFaqs = cityFaqExtras({
  region: city("WA", "vancouver", "Vancouver", "washington", "Washington"),
  glance: {
    listedCount: 12,
    sdcCount: 3,
    size: { lte6: 8, from7to10: 1, gte11: 3 },
  } as CityHubGlance,
});
const certifiedAnswer =
  vancouverFaqs.find((pair) => pair.q.startsWith("What does Memory Care Certified"))?.a ?? "";
assert.doesNotMatch(certifiedAnswer, /adult family home dementia specialty/);
assert.match(certifiedAnswer, /don't count it as memory care/);
assert.match(certifiedAnswer, /Confirmed: accepts residents with dementia/);
assert.match(certifiedAnswer, /Dementia credential/);
assert.match(certifiedAnswer, /does not confirm the home currently accepts/);
assert.match(certifiedAnswer, /Neither label is a secured or dedicated unit/);

console.log("city hub accuracy checks passed");
