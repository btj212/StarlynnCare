/**
 * Quality-gate checks. An indexable home needs a real inspection and a
 * regulator sentence from the approved table. Tier B never joins a
 * memory-care hub. The hub count is the length of that list.
 *
 * Run: npm run test:quality-gate
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { facilityMarkedNoindex } from "../src/lib/seo/indexability.ts";
import {
  buildBreadcrumbList,
  buildLocalBusinessForFacility,
} from "../src/lib/seo/schema.ts";
import type { Facility } from "../src/lib/types.ts";
import {
  AZ_MC_SOURCE_AVAILABLE,
  cityHubPageExists,
  facilityListedOnHub,
  listingHubMarkedNoindex,
  DIRECTORY_BADGE,
  GATE_ENFORCED,
  HEADLINE_TABLE,
  NONE_EXPLANATION,
  noneHeadline,
  PHONE_BADGE,
  PROBATION_BADGE,
  TIER_A_GAPS,
  UNENDORSED_BADGE,
  canonicalLicenseStatus,
  evidenceLabelText,
  explainIndexability,
  headlineLabel,
  inspectionQualifies,
  isIndexable,
  jsonLdIsValid,
  memoryCareHubHomes,
  memoryCareHubView,
  profileRobotsNoindex,
  rowsForSitemap,
  secondaryBadges,
  type GateHome,
} from "../src/lib/quality/gate.ts";

const NOW = new Date("2026-11-27T12:00:00Z");

function home(partial: GateHome): GateHome {
  return {
    name: "Example Home",
    city: "Portland",
    city_slug: "portland",
    slug: "example-home",
    license_status: "LICENSED",
    license_type: "RCF",
    license_number: "LIC-1",
    updated_at: "2026-11-01T00:00:00Z",
    sync_at: "2026-11-20T00:00:00Z",
    title: "Example Home, Portland",
    h1: "Example Home",
    canonical: "https://www.starlynncare.com/oregon/portland/example-home",
    inspections: [{ date: "2026-06-01", sourceUrl: "https://example.gov/report.pdf" }],
    ...partial,
  };
}

const indexable = home({ state_code: "OR", mce_endorsed: true });

assert.equal(isIndexable(indexable, NOW), true, "a licensed endorsed home with an inspection is indexable");
assert.equal(
  isIndexable(home({ state_code: "OR", mce_endorsed: true, inspections: [] }), NOW),
  false,
  "an indexable fixture must have an inspection",
);
assert.equal(
  isIndexable(
    home({
      state_code: "OR",
      mce_endorsed: false,
      license_type: null,
      mc_signal_caring_listed: true,
      mc_signal_explicit_name: true,
    }),
    NOW,
  ),
  false,
  "directory-only evidence with no license type is not a regulator label",
);

const decision = explainIndexability(indexable, NOW);
assert.equal(decision.headline.tier, "A");
assert.equal(decision.headline.label, HEADLINE_TABLE.OR_A.label);
assert.equal(decision.failures.length, 0);

assert.equal(canonicalLicenseStatus("PROBATIONARY", "IL"), "PROBATION");
assert.equal(canonicalLicenseStatus("ON PROBATION", "CA"), "PROBATION");
assert.equal(canonicalLicenseStatus("PDR-APPEAL PEND", "PA"), "PENDING");
assert.equal(canonicalLicenseStatus("CERTIFIED", "CO"), "LICENSED");
assert.equal(canonicalLicenseStatus("CLOSED", "OR"), "CLOSED");
assert.equal(canonicalLicenseStatus("PENDING", "MN"), "PENDING");
assert.equal(canonicalLicenseStatus("LICENSED", "WA"), "LICENSED");
assert.equal(canonicalLicenseStatus(null, "MN"), "OTHER");
assert.equal(canonicalLicenseStatus("  ", "CA"), "OTHER");
assert.equal(canonicalLicenseStatus("not a status", "TX"), "OTHER");

const closedNoInspection = explainIndexability(
  home({ state_code: "CA", license_status: "CLOSED", inspections: [], mce_endorsed: false }),
  NOW,
);
assert.equal(closedNoInspection.failures.includes("license_status"), true);
assert.equal(closedNoInspection.failures.includes("inspection"), true);

const closedWithInspection = explainIndexability(
  home({ state_code: "CA", license_status: "CLOSED", license_type: "RCFE" }),
  NOW,
);
assert.equal(closedWithInspection.failures.includes("license_status"), false);
assert.equal(closedWithInspection.failures.includes("inspection"), false);

assert.equal(
  inspectionQualifies("IL", { date: "2026-05-09", citationCount: 0, visitId: "00120001" }),
  true,
  "Illinois counts a visit with a date, a zero citation count, and the FOIA visit id",
);
assert.equal(
  inspectionQualifies("IL", { date: "2026-05-09", citationCount: 0 }),
  false,
  "Illinois does not count a visit that has no visit id",
);
assert.equal(
  explainIndexability(
    home({
      state_code: "IL",
      canonical: "https://www.starlynncare.com/illinois/chicago/example-home",
      inspections: [{ date: "2026-05-09", citationCount: 4, visitId: "00120001" }],
    }),
    NOW,
  ).failures.includes("inspection"),
  false,
);
assert.equal(
  explainIndexability(
    home({
      state_code: "IL",
      canonical: "https://www.starlynncare.com/illinois/chicago/example-home",
      inspections: [{ date: "2026-05-09", citationCount: 4 }],
    }),
    NOW,
  ).failures.includes("inspection"),
  true,
);

assert.equal(
  inspectionQualifies("CO", { date: "2026-05-13", citationCount: 2, visitId: "M5T211" }),
  true,
  "Colorado counts an event with a date, a citation count, and the CDPHE event id",
);
assert.equal(
  inspectionQualifies("CO", { date: "2026-05-13", citationCount: 2, sourceUrl: "https://example.gov/missing" }),
  false,
  "Colorado does not count an event that has no event id",
);
assert.equal(
  explainIndexability(
    home({
      state_code: "CO",
      canonical: "https://www.starlynncare.com/colorado/denver/example-home",
      inspections: [{ date: "2026-05-13", citationCount: 0, visitId: "M5T211" }],
    }),
    NOW,
  ).failures.includes("inspection"),
  false,
);

assert.equal(
  inspectionQualifies("WA", { date: "2025-09-04", citationCount: 5 }),
  false,
  "Washington still needs an http source URL",
);
assert.equal(
  inspectionQualifies("WA", {
    date: "2025-09-04",
    citationCount: 5,
    sourceUrl: "https://fortress.wa.gov/dshs/adsaapps/lookup/report.pdf",
  }),
  true,
);
assert.equal(
  explainIndexability(
    home({
      state_code: "WA",
      canonical: "https://www.starlynncare.com/washington/seattle/example-home",
      inspections: [{ date: "2025-09-04", citationCount: 5 }],
    }),
    NOW,
  ).failures.includes("inspection"),
  true,
);

const predecessorOnly = explainIndexability(
  home({
    state_code: "AZ",
    az_license_level: "Directed Care",
    inspections: [
      { date: "2025-03-12", sourceUrl: "https://azcarecheck.azdhs.gov/old-a", predecessor: true },
      { date: "2025-01-27", sourceUrl: "https://azcarecheck.azdhs.gov/old-b", predecessor: true },
    ],
  }),
  NOW,
);
assert.equal(
  predecessorOnly.failures.includes("inspection"),
  true,
  "inspections of a previous facility do not meet this home's inspection requirement",
);

const ownPlusPredecessor = explainIndexability(
  home({
    state_code: "AZ",
    az_license_level: "Directed Care",
    inspections: [
      { date: "2026-08-01", sourceUrl: "https://azcarecheck.azdhs.gov/own" },
      { date: "2025-03-12", sourceUrl: "https://azcarecheck.azdhs.gov/old-a", predecessor: true },
    ],
  }),
  NOW,
);
assert.equal(ownPlusPredecessor.failures.includes("inspection"), false);

const californiaOwnInspection = explainIndexability(
  home({ state_code: "CA", license_type: "RCFE" }),
  NOW,
);
assert.equal(
  californiaOwnInspection.failures.includes("inspection"),
  false,
  "a non-Arizona home with its own inspection is unchanged",
);
assert.equal(
  inspectionQualifies("IL", {
    date: "2026-05-09",
    citationCount: 0,
    visitId: "00120001",
    predecessor: true,
  }),
  false,
  "a previous operator's visit does not satisfy this home, including in Illinois",
);

const approvedLabels = new Set(Object.values(HEADLINE_TABLE).map((row) => row.label));
const approvedExplanations = new Set(Object.values(HEADLINE_TABLE).map((row) => row.explanation));

const matrix: GateHome[] = [
  home({ state_code: "OR", mce_endorsed: true }),
  home({ state_code: "MN", mn_dementia_care_licensed: true, canonical: "https://www.starlynncare.com/minnesota/portland/example-home" }),
  home({ state_code: "PA", mc_designation_type: "Secure Dementia Care Unit" }),
  home({ state_code: "PA", mc_designation_type: "Special Care" }),
  home({ state_code: "UT", secure_beds: 12 }),
  home({ state_code: "UT", secure_beds: 0 }),
  home({ state_code: "IL", il_dementia_program_flag: true }),
  home({ state_code: "MO", mo_alzheimer_scu: true }),
  home({ state_code: "TX", tx_alzheimer_certified: true }),
  home({ state_code: "WA", wa_memory_care_certified: true, wa_facility_type: "ALF" }),
  home({ state_code: "WA", wa_dementia_care_contract: true, wa_earc_sdc_contracted: true, wa_facility_type: "ALF" }),
  home({ state_code: "WA", wa_dementia_specialty: true, wa_facility_type: "AFH" }),
  home({ state_code: "WA", wa_dementia_specialty: true, wa_facility_type: "ALF" }),
  home({ state_code: "CA", ca_cdss_client_served: ["983 - RCFE / DEMENTIA"], memory_care_disclosure_filed: true }),
  home({ state_code: "CA", memory_care_disclosure_filed: true, license_type: "RCFE" }),
  home({ state_code: "AZ", az_memory_care_endorsed: true, az_license_level: "Directed Care" }),
  home({ state_code: "AZ", az_memory_care_endorsed: true, az_license_level: "Personal Care" }),
  home({ state_code: "CO", license_type: "ALR ONLY", mc_signal_apfm_listed: true, mc_signal_caring_listed: true }),
  home({ state_code: "OR", name: "Rose Memory Care", mce_endorsed: false, mc_signal_explicit_name: true, mc_program_confirmed: true }),
  home({ state_code: "WA", mc_program_confirmed: true, wa_facility_type: "AFH", license_type: "AFH" }),
];

for (const row of matrix) {
  const label = headlineLabel(row);
  if (!label.label) {
    assert.equal(label.fromRegulator, false);
    continue;
  }
  if (label.tier === "none") {
    assert.match(label.label, /^Licensed .+, no memory-care information on file$/);
    assert.equal(label.explanation, NONE_EXPLANATION);
  } else {
    assert.equal(approvedLabels.has(label.label), true, label.label);
    assert.equal(approvedExplanations.has(label.explanation), true, label.explanation);
  }
  assert.equal(label.explanation.length > 0, true);
}

assert.equal(headlineLabel(matrix.find((row) => row.state_code === "CA" && row.memory_care_disclosure_filed && !row.ca_cdss_client_served)!).tier, "none");
assert.equal(noneHeadline("RCFE"), "Licensed RCFE, no memory-care information on file");
assert.equal(/\bMemory Care\b/.test(noneHeadline("RCFE")), false);
assert.equal(TIER_A_GAPS.some((gap) => gap.state === "CA"), true);
assert.equal(AZ_MC_SOURCE_AVAILABLE, false);
assert.equal(
  headlineLabel(home({ state_code: "AZ", az_memory_care_endorsed: true, az_license_level: "Directed Care" })).label,
  HEADLINE_TABLE.AZ_B.label,
);
const azPersonalHeadline = headlineLabel(
  home({
    state_code: "AZ",
    az_memory_care_endorsed: true,
    az_license_level: "Personal Care",
    license_type: "Assisted Living Home",
  }),
);
assert.equal(azPersonalHeadline.tier, "none");
assert.notEqual(azPersonalHeadline.label, HEADLINE_TABLE.AZ_B.label);
assert.doesNotMatch(azPersonalHeadline.label, /Directed Care/);
assert.equal(GATE_ENFORCED, false);
assert.equal(
  headlineLabel(home({ state_code: "WA", wa_dementia_specialty: true, wa_facility_type: "AFH", wa_memory_care_certified: false })).tier,
  "B",
);
assert.notEqual(
  headlineLabel(home({ state_code: "OR", mc_program_confirmed: true, name: "Memory Care Lodge" })).tier,
  "A",
);

const hubInput = [
  home({ state_code: "OR", mce_endorsed: true }),
  home({ state_code: "AZ", az_license_level: "Directed Care" }),
  home({ state_code: "WA", wa_dementia_specialty: true, wa_facility_type: "AFH" }),
  home({ state_code: "CA", ca_cdss_client_served: ["983 - RCFE / Dementia"] }),
];
const view = memoryCareHubView(hubInput);
assert.equal(view.count, view.homes.length, "hub count is the list count");
assert.equal(view.homes.length, 1);
assert.equal(view.homes.every((row) => headlineLabel(row).tier === "A"), true);
assert.equal(memoryCareHubHomes(hubInput).some((row) => headlineLabel(row).tier === "B"), false);

const phone = secondaryBadges(
  home({
    state_code: "WA",
    mc_designation_type: "accepts_dementia_no_secured_unit",
    mc_program_quote: "We do have dementia residents.",
    license_status: "PROBATIONARY",
    mc_signal_caring_listed: true,
  }),
);
assert.deepEqual(
  phone.map((badge) => badge.label),
  [PHONE_BADGE, DIRECTORY_BADGE, PROBATION_BADGE],
);
assert.equal(phone.find((badge) => badge.label === PROBATION_BADGE)?.tone, "red");
assert.equal(
  secondaryBadges(
    home({ state_code: "WA", mc_designation_type: "accepts_dementia_no_secured_unit" }),
  ).some((badge) => badge.label === PHONE_BADGE),
  false,
);
const unendorsed = secondaryBadges(home({ state_code: "OR", name: "Cedar Memory Care", mce_endorsed: false }));
assert.equal(unendorsed.some((badge) => badge.label === UNENDORSED_BADGE && badge.tone === "red"), true);
assert.equal(
  secondaryBadges(home({ state_code: "OR", name: "Cedar Memory Care", mce_endorsed: true })).some(
    (badge) => badge.label === UNENDORSED_BADGE,
  ),
  false,
);

const stale = explainIndexability(
  home({ state_code: "OR", mce_endorsed: true, updated_at: "2024-01-01", sync_at: "2026-11-01" }),
  NOW,
);
assert.equal(stale.failures.includes("freshness"), true);
const noClock = explainIndexability(
  home({ state_code: "WA", wa_memory_care_certified: true, sync_at: null, wa_facility_type: "ALF" }),
  NOW,
);
assert.equal(noClock.freshness, "todo_no_sync");
assert.equal(noClock.failures.includes("freshness"), false);
assert.equal(noClock.indexable, true);

const legacy = {
  stateCode: "WA",
  beds: 6,
  deficiencyCount: 0,
  inspectionCount: 0,
  reviewCount: 0,
  tourQuestionCount: 0,
  photoCount: 0,
};
assert.equal(GATE_ENFORCED, false);
assert.equal(
  facilityListedOnHub({ stateCode: "WA", beds: 6, deficiencyCount: 0, inspectionCount: 0 }),
  true,
);
assert.equal(
  facilityListedOnHub({ stateCode: "AZ", beds: 8, deficiencyCount: 0, inspectionCount: 0 }),
  true,
);
assert.equal(cityHubPageExists(0), false);
assert.equal(cityHubPageExists(1), true);
assert.equal(
  listingHubMarkedNoindex([{ stateCode: "AZ", beds: 6, deficiencyCount: 0, inspectionCount: 0 }]),
  false,
);
assert.equal(profileRobotsNoindex({ legacy, home: indexable, now: NOW }), facilityMarkedNoindex(legacy));
assert.equal(evidenceLabelText(indexable, "Oregon DHS"), "Oregon DHS");
const rows = [{ id: "a" }, { id: "b" }];
assert.equal(rowsForSitemap(rows, "WA", () => false), rows);

const facility = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Example Home",
  slug: "example-home",
  city: "Portland",
  city_slug: "portland",
  state_code: "OR",
  street: "1 Main St",
  zip: "97201",
  license_number: "LIC-1",
  care_category: "alf_general",
  beds: 20,
} as unknown as Facility;
const local = buildLocalBusinessForFacility(facility, { code: "OR", slug: "oregon", name: "Oregon" }, {
  canonicalUrl: "https://www.starlynncare.com/oregon/portland/example-home",
});
const crumbs = buildBreadcrumbList([
  { name: "Home", url: "https://www.starlynncare.com/" },
  { name: "Example Home", url: "https://www.starlynncare.com/oregon/portland/example-home" },
]);
assert.equal(jsonLdIsValid([local, crumbs]), true);
assert.equal(jsonLdIsValid([crumbs]), false);
const missingLicense = buildLocalBusinessForFacility(
  { ...facility, license_number: null } as unknown as Facility,
  { code: "OR", slug: "oregon", name: "Oregon" },
  { canonicalUrl: "https://www.starlynncare.com/oregon/portland/example-home" },
);
assert.equal(jsonLdIsValid([missingLicense, crumbs]), false);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const srcFiles = walk(path.join(root, "src"));
const headlineNeedles = [
  ...Object.values(HEADLINE_TABLE).map((row) => row.label),
  NONE_EXPLANATION,
];
for (const file of srcFiles) {
  if (file.endsWith(`${path.sep}src${path.sep}lib${path.sep}quality${path.sep}gate.ts`)) continue;
  const text = readFileSync(file, "utf8");
  if (file.endsWith(`${path.sep}src${path.sep}lib${path.sep}seo${path.sep}indexability.ts`)) {
    assert.equal(/export function /.test(text), false, "indexability.ts must delegate to the gate");
    assert.equal(text.includes('from "@/lib/quality/gate"'), true);
  }
  for (const needle of headlineNeedles) {
    assert.equal(text.includes(needle), false, `${path.relative(root, file)} defines a headline string`);
  }
  assert.equal(/export function (isIndexable|headlineLabel|canonicalLicenseStatus)\b/.test(text), false, file);
}

const preExistingNoindex = new Set([
  "src/app/[state]/[city]/[facility]/page.tsx",
  "src/app/[state]/[city]/page.tsx",
  "src/app/bibliofangirl/page.tsx",
  "src/app/[state]/[city]/facilities/page.tsx",
  "src/app/admin/layout.tsx",
  "src/app/[state]/[city]/[facility]/confirm/page.tsx",
  "src/app/[state]/[city]/[facility]/inspections/page.tsx",
  "src/app/watch/area/unsubscribe/[token]/page.tsx",
  "src/app/watch/billing/[token]/page.tsx",
  "src/app/watch/paid/success/page.tsx",
  "src/app/preferences/[token]/page.tsx",
  "src/app/shortlist/page.tsx",
  "src/app/shortlist/shared/page.tsx",
  "src/app/unlock/page.tsx",
  "src/app/unsubscribe/page.tsx",
  "src/app/not-found.tsx",
  "src/lib/content/articleReview.ts",
  "src/lib/seo/indexability.ts",
]);

for (const file of srcFiles) {
  const rel = path.relative(root, file);
  const text = readFileSync(file, "utf8");
  const decidesNoindex = /index:\s*false/.test(text) || rel === "src/lib/seo/indexability.ts";
  if (!decidesNoindex) continue;
  if (rel === "src/app/[state]/[city]/[facility]/page.tsx" || rel === "src/app/[state]/[city]/[facility]/inspections/page.tsx") {
    assert.equal(text.includes("profileRobotsNoindex"), true, `${rel} must delegate robots to the gate`);
  }
  if (rel === "src/components/facility/profile/FacilityHero.tsx") {
    assert.equal(text.includes("evidenceLabelText"), true);
  }
  assert.equal(
    preExistingNoindex.has(rel) || text.includes('@/lib/quality/gate'),
    true,
    `${rel} adds a noindex decision outside the gate`,
  );
}

const banned = [/does not offer memory care/i, /\btop-rated\b/i, /\bbest\b/i];
const deslop = /Deslop\.ts$/;
function stringLiterals(source: string): string[] {
  const out: string[] = [];
  const re = /`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"/g;
  for (const match of source.match(re) ?? []) out.push(match);
  return out;
}
for (const file of walk(path.join(root, "src", "lib"))) {
  if (deslop.test(file)) continue;
  const literals = stringLiterals(readFileSync(file, "utf8"));
  for (const literal of literals) {
    for (const pattern of banned) {
      assert.equal(pattern.test(literal), false, `${path.relative(root, file)} contains banned copy ${pattern}`);
    }
  }
}

console.log("quality gate checks passed");
