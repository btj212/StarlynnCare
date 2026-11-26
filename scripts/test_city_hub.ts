import assert from "node:assert/strict";
import { formatFacilityName } from "../src/lib/facility/displayName.ts";
import { dedupeHomesByDisplayName } from "../src/lib/city-hub/dedupe.ts";
import {
  belongsOnCityPage,
  displayMunicipality,
} from "../src/lib/city-hub/municipality.ts";
import { cityHubTitle, cityHubH1, cityHubMetaDescription } from "../src/lib/city-hub/copy.ts";
import { paFormatSeverityTag } from "../src/lib/states/PA/profileConfig.ts";
import type { Region } from "../src/lib/regions.ts";
import type { Deficiency } from "../src/lib/types.ts";

assert.equal(formatFacilityName("CLASS ACT GLENCOVE MESA, LLC"), "Class Act Glencove Mesa, LLC");
assert.equal(formatFacilityName("SUNRISE OF MESA II"), "Sunrise of Mesa II");
assert.equal(formatFacilityName("THE CITADEL ASSISTED LIVING FACILITY"), "The Citadel Assisted Living Facility");
assert.equal(formatFacilityName("PEACEFUL HAVEN ASSISTED LIVING L L C"), "Peaceful Haven Assisted Living LLC");
assert.equal(formatFacilityName("Legacy Retirement Residence"), "Legacy Retirement Residence");

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

console.log("city hub accuracy checks passed");
