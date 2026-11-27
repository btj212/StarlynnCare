import assert from "node:assert/strict";
import { formatFacilityName } from "../src/lib/facility/displayName.ts";
import { dedupeHomesByDisplayName } from "../src/lib/city-hub/dedupe.ts";
import {
  belongsOnCityPage,
  displayMunicipality,
} from "../src/lib/city-hub/municipality.ts";
import { cityHubTitle, cityHubH1, cityHubMetaDescription, cityFaqExtras } from "../src/lib/city-hub/copy.ts";
import {
  CITY_HUB_SECTION_ORDER,
  SMALL_HOMES_PREVIEW_COUNT,
  cityHubCardGroup,
  cityHubSectionId,
  listCareChip,
  listedInMemoryCareGroup,
} from "../src/lib/city-hub/careSetting.ts";
import { quoteHomesOnPage } from "../src/lib/city-hub/dedupe.ts";
import { homesForCityIndex } from "../src/lib/facility/hubPreview.ts";
import { cityHubPageExists, facilityListedOnHub } from "../src/lib/seo/indexability.ts";
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

type HubHome = {
  id: string;
  name: string;
  beds: number | null;
  inspections: number;
  total_citations: number;
  capacity_tier: "small" | "medium" | "large" | "unknown";
  careChip: string | null;
  serves_memory_care: boolean;
  memory_care_disclosure_filed: boolean;
};

function sectionFor(home: HubHome, stateSlug: string) {
  return cityHubSectionId({
    careChip: home.careChip,
    capacityTier: home.capacity_tier,
    inMemoryCareGroup: listedInMemoryCareGroup({
      stateSlug,
      careChip: home.careChip,
      servesMemoryCare: home.serves_memory_care,
      memoryCareDisclosureFiled: home.memory_care_disclosure_filed,
    }),
  });
}

function listedSections(homes: HubHome[], stateCode: string, stateSlug: string) {
  const listed = homesForCityIndex(homes, stateCode);
  const sections = new Map<string, string>();
  for (const home of listed) sections.set(home.id, sectionFor(home, stateSlug));
  return { listed, sections };
}

// Mesa-like: the old rule hid the 8-bed home with no citations and the 6-bed
// home with no citations. The page now lists every one, once, and the number
// it prints is that list.
const mesaLike: HubHome[] = [
  {
    id: "large",
    name: "Large Home",
    beds: 80,
    inspections: 4,
    total_citations: 2,
    capacity_tier: "large",
    careChip: "Directed Care",
    serves_memory_care: true,
    memory_care_disclosure_filed: false,
  },
  {
    id: "medium-uncited",
    name: "Eight Bed Home",
    beds: 8,
    inspections: 1,
    total_citations: 0,
    capacity_tier: "medium",
    careChip: null,
    serves_memory_care: false,
    memory_care_disclosure_filed: false,
  },
  {
    id: "small-uncited",
    name: "Six Bed Home",
    beds: 6,
    inspections: 1,
    total_citations: 0,
    capacity_tier: "small",
    careChip: null,
    serves_memory_care: false,
    memory_care_disclosure_filed: false,
  },
  {
    id: "small-cited",
    name: "Cited Cottage",
    beds: 5,
    inspections: 2,
    total_citations: 1,
    capacity_tier: "small",
    careChip: null,
    serves_memory_care: false,
    memory_care_disclosure_filed: false,
  },
  {
    id: "other",
    name: "Other Licensed",
    beds: 40,
    inspections: 3,
    total_citations: 1,
    capacity_tier: "medium",
    careChip: null,
    serves_memory_care: false,
    memory_care_disclosure_filed: false,
  },
];
const mesaListed = listedSections(mesaLike, "AZ", "arizona");
assert.equal(mesaListed.listed.length, mesaLike.length, "small and uncited homes stay on the list");
assert.equal(mesaListed.sections.size, mesaLike.length, "each home is in exactly one section");
assert.equal(mesaListed.sections.get("large"), "memory-care-large");
assert.equal(mesaListed.sections.get("medium-uncited"), "other");
assert.equal(mesaListed.sections.get("small-uncited"), "small");
assert.equal(mesaListed.sections.get("small-cited"), "small");
assert.equal(mesaListed.sections.get("other"), "other");
assert.equal(
  facilityListedOnHub({ stateCode: "AZ", beds: 8, deficiencyCount: 0, inspectionCount: 1 }),
  true,
);
assert.equal(
  facilityListedOnHub({ stateCode: "WA", beds: 6, deficiencyCount: 0, inspectionCount: 0 }),
  true,
);

const shown = mesaListed.listed.length;
const listedOnPage = [...mesaListed.sections.values()].length;
assert.equal(shown, listedOnPage, "the number on the page is the number of homes listed");

// Washington: a confirmed home and a credential home stay in those sections
// even at 6 beds. A small home with no tier chip is a small home. None of
// them is dropped, and none is listed twice.
const washington: HubHome[] = [
  {
    id: "wa-confirmed",
    name: "Amber Hills",
    beds: 6,
    inspections: 0,
    total_citations: 0,
    capacity_tier: "small",
    careChip: "Confirmed: accepts residents with dementia",
    serves_memory_care: false,
    memory_care_disclosure_filed: false,
  },
  {
    id: "wa-credential",
    name: "Specialty Family Home",
    beds: 6,
    inspections: 0,
    total_citations: 0,
    capacity_tier: "small",
    careChip: "Dementia credential",
    serves_memory_care: false,
    memory_care_disclosure_filed: false,
  },
  {
    id: "wa-small",
    name: "Plain Family Home",
    beds: 6,
    inspections: 0,
    total_citations: 0,
    capacity_tier: "small",
    careChip: null,
    serves_memory_care: false,
    memory_care_disclosure_filed: false,
  },
  {
    id: "wa-memory",
    name: "Certified House",
    beds: 60,
    inspections: 3,
    total_citations: 1,
    capacity_tier: "large",
    careChip: "Memory Care Certified",
    serves_memory_care: true,
    memory_care_disclosure_filed: false,
  },
];
const wa = listedSections(washington, "WA", "washington");
assert.equal(wa.listed.length, washington.length);
assert.equal(wa.sections.size, washington.length);
assert.equal(wa.sections.get("wa-confirmed"), "confirmed-accepts");
assert.equal(wa.sections.get("wa-credential"), "credential");
assert.equal(wa.sections.get("wa-small"), "small");
assert.equal(wa.sections.get("wa-memory"), "memory-care-large");
assert.ok(
  CITY_HUB_SECTION_ORDER.indexOf("confirmed-accepts") <
    CITY_HUB_SECTION_ORDER.indexOf("credential"),
);
assert.ok(
  CITY_HUB_SECTION_ORDER.indexOf("credential") < CITY_HUB_SECTION_ORDER.indexOf("small"),
);
assert.ok(CITY_HUB_SECTION_ORDER.indexOf("small") < CITY_HUB_SECTION_ORDER.indexOf("other"));
assert.equal(SMALL_HOMES_PREVIEW_COUNT, 24);

const manySmall = Array.from({ length: 30 }, (_, i) => i);
assert.equal(manySmall.slice(0, SMALL_HOMES_PREVIEW_COUNT).length, 24);
assert.equal(manySmall.length, 30);

// A city with nothing to list is not a hub, so it is not counted or linked.
const hubCities = [
  { slug: "mesa", listedCount: 169 },
  { slug: "empty", listedCount: 0 },
].filter((city) => cityHubPageExists(city.listedCount));
assert.deepEqual(hubCities.map((city) => city.slug), ["mesa"]);
assert.equal(cityHubPageExists(0), false);
assert.equal(cityHubPageExists(1), true);

// Same name and ZIP in Pennsylvania is one line. The headline uses that count.
const pittsburgh = quoteHomesOnPage(
  [
    { id: "a", name: "Canterbury Place", inspections: 1, total_citations: 0, zip: "15201" },
    { id: "b", name: "CANTERBURY PLACE", inspections: 4, total_citations: 2, zip: "15201" },
    { id: "c", name: "Other Home", inspections: 1, total_citations: 0, zip: "15201" },
  ],
  "PA",
);
assert.equal(pittsburgh.length, 2);
assert.equal(quoteHomesOnPage(pittsburgh, "AZ").length, 2);

console.log("city hub accuracy checks passed");
