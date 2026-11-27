/**
 * A new home at a closed address shows the previous operator's inspections
 * under their own name. Those visits do not change this home's citation-hook
 * title, its inspection summary, or its LocalBusiness graph.
 *
 * Run: npx tsx scripts/test_address_successor.ts
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InspectionSummary } from "../src/components/facility/profile/InspectionSummary.tsx";
import {
  ClosedSuccessorLink,
  PREVIOUS_FACILITY_EXPLANATION,
  PREVIOUS_FACILITY_HEADING,
  PreviousFacilityInspections,
} from "../src/components/facility/profile/PreviousFacilityInspections.tsx";
import {
  licensedDatesLabel,
  loadAddressHistory,
  noteNamesSuccessor,
  predecessorRowIdsFromNote,
  successorRowIdFromNote,
  type PreviousFacilityAtAddress,
} from "../src/lib/facility/addressSuccessor.ts";
import { buildFacilityTitle } from "../src/lib/seo/meta.ts";
import { buildLocalBusinessForFacility } from "../src/lib/seo/schema.ts";
import type { Facility } from "../src/lib/types.ts";

const SUCCESSOR_ID = "6d3d6d03-a395-4ad4-bdf0-dc7ff28cb55f";
const AEGIS_ID = "6ab04d04-c1fc-4baa-beec-c8e8678eaf4f";
const JANNAH_ID = "2fa7048e-bdd6-4782-965f-2a79fe9cd526";

const OLD_NOTE =
  "AZ Care Check 2026-11-27: license AL10538H closed. Previous facility at this address. " +
  "New licensed home here: SAKINA ASSISTED LIVING CARE LLC (ALH20408) = " +
  `StarlynnCare row ${SUCCESSOR_ID} (unpublished).`;

const NEW_NOTE =
  "AZ Care Check 2026-11-27: Active, license ALH20408. New licensed home at the address of " +
  `previous StarlynnCare row(s): ${AEGIS_ID} (AEGIS AT HOMESTEAD ASSISTED LIVING HOME, AL10538H); ` +
  `${JANNAH_ID} (JANNAH ASSISTED LIVING, LLC, AL13342H)`;

assert.equal(successorRowIdFromNote(OLD_NOTE), SUCCESSOR_ID);
assert.equal(noteNamesSuccessor(OLD_NOTE, SUCCESSOR_ID), true);
assert.deepEqual(predecessorRowIdsFromNote(NEW_NOTE), [AEGIS_ID, JANNAH_ID]);
assert.equal(
  successorRowIdFromNote(NEW_NOTE),
  null,
  "the new row's list of old ids is not itself a successor pointer",
);
assert.deepEqual(predecessorRowIdsFromNote(OLD_NOTE), []);
assert.equal(successorRowIdFromNote("Closed, Change of Ownership"), null);
assert.deepEqual(predecessorRowIdsFromNote("Closed, Change of Ownership"), []);
assert.equal(
  successorRowIdFromNote("[WA license successor] DSHS reissued 2801 for license 2141"),
  null,
);

assert.equal(
  licensedDatesLabel({ initial: null, expiration: null, closed: null }),
  null,
);
assert.equal(
  licensedDatesLabel({ initial: "2020-01-15", expiration: "2024-03-01", closed: null }),
  "Licensed January 15, 2020 to March 1, 2024",
);
assert.equal(
  licensedDatesLabel({ initial: null, expiration: "2024-03-01", closed: "2024-02-02" }),
  "License closed February 2, 2024",
);

const predecessors: PreviousFacilityAtAddress[] = [
  {
    id: AEGIS_ID,
    name: "Aegis at Homestead Assisted Living Home",
    licenseNumber: "AL10538H",
    licensedLabel: "Licensed January 15, 2020 to March 1, 2024",
    inspections: [
      {
        id: "insp-aegis",
        dateLabel: "March 12, 2025",
        citationCount: 9,
        sourceUrl: "https://azcarecheck.azdhs.gov/s/facility-details?facilityId=aegis",
      },
    ],
  },
  {
    id: JANNAH_ID,
    name: "Jannah Assisted Living, LLC",
    licenseNumber: "AL13342H",
    licensedLabel: null,
    inspections: [
      {
        id: "insp-jannah",
        dateLabel: "January 27, 2025",
        citationCount: 4,
        sourceUrl: "https://azcarecheck.azdhs.gov/s/facility-details?facilityId=jannah",
      },
    ],
  },
];

const title = buildFacilityTitle({
  name: "Sakina Care",
  stateName: "Arizona",
  stateCode: "AZ",
  city: "Phoenix",
  percentile: null,
  citationCount: 2,
  inspectionCount: 1,
  lastInspectionDate: "2026-08-01",
  azLicenseLevel: "Directed Care",
});
assert.equal(title, "Sakina Care, Phoenix — 2 citations, inspected Aug 2026");
assert.equal(title.includes("9 citations"), false);
assert.equal(title.includes("4 citations"), false);
assert.equal(title.includes("13 citations"), false);

const facility = {
  id: SUCCESSOR_ID,
  name: "SAKINA ASSISTED LIVING CARE LLC",
  slug: "sakina-assisted-living-care-llc",
  city: "Phoenix",
  city_slug: "phoenix",
  state_code: "AZ",
  street: "1 Homestead",
  zip: "85001",
  license_number: "ALH20408",
  care_category: "alf_general",
  beds: 10,
} as unknown as Facility;

const localBusiness = buildLocalBusinessForFacility(
  facility,
  { code: "AZ", slug: "arizona", name: "Arizona" },
  {
    canonicalUrl: "https://www.starlynncare.com/arizona/phoenix/sakina-assisted-living-care-llc",
    extras: {
      citationCount: 2,
      lastInspectionDate: "2026-08-01",
      regulatorAbbr: "ADHS",
    },
  },
);
const graph = JSON.stringify(localBusiness);
assert.equal(graph.includes("Aegis at Homestead"), false);
assert.equal(graph.includes("Jannah Assisted Living"), false);
assert.equal(graph.includes("AL10538H"), false);
assert.equal(graph.includes(PREVIOUS_FACILITY_HEADING), false);
assert.match(graph, /2 ADHS citations/);

const html = renderToStaticMarkup(
  <>
    <InspectionSummary lastInspected="August 2026" inspectionCount={1} citationCount={2} />
    <PreviousFacilityInspections facilities={predecessors} />
    <ClosedSuccessorLink
      successor={{
        name: "Sakina Assisted Living Care LLC",
        href: "/arizona/phoenix/sakina-assisted-living-care-llc",
      }}
    />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />
  </>,
);

assert.equal(html.includes(PREVIOUS_FACILITY_HEADING), true);
assert.equal(html.includes(PREVIOUS_FACILITY_EXPLANATION), true);
assert.equal(html.includes("Aegis at Homestead Assisted Living Home"), true);
assert.equal(html.includes("Jannah Assisted Living, LLC"), true);
assert.equal(html.includes("License AL10538H"), true);
assert.equal(html.includes("License AL13342H"), true);
assert.equal(html.includes("Licensed January 15, 2020 to March 1, 2024"), true);
assert.equal(html.includes("March 12, 2025"), true);
assert.equal(html.includes("9 citations"), true);
assert.equal(html.includes("January 27, 2025"), true);
assert.equal(html.includes("4 citations"), true);
assert.equal(html.includes("https://azcarecheck.azdhs.gov/s/facility-details?facilityId=aegis"), true);
assert.equal(html.includes("https://azcarecheck.azdhs.gov/s/facility-details?facilityId=jannah"), true);
assert.equal(html.includes("1 inspection"), true);
assert.equal(html.includes("2 citations"), true);
assert.equal(
  html.includes("Now operating at this address: Sakina Assisted Living Care LLC"),
  true,
);
assert.equal(html.includes('href="/arizona/phoenix/sakina-assisted-living-care-llc"'), true);

const script = html.slice(html.indexOf('type="application/ld+json"'));
assert.equal(script.includes("Aegis"), false);
assert.equal(script.includes("Jannah"), false);

assert.equal(html.includes("does not offer memory care"), false);
assert.equal(html.toLowerCase().includes("top-rated"), false);
assert.equal(/\bbest\b/i.test(html), false);

async function main(): Promise<void> {
const empty = renderToStaticMarkup(<PreviousFacilityInspections facilities={[]} />);
assert.equal(empty, "");
const unpublished = renderToStaticMarkup(<ClosedSuccessorLink successor={null} />);
assert.equal(unpublished, "");

const california = await loadAddressHistory({
  facilityId: "00000000-0000-4000-8000-000000000001",
  stateCode: "CA",
  stateSlug: "california",
  licenseStatus: "CLOSED",
  licenseStatusDetail: "Closed, Change of Ownership",
});
assert.deepEqual(california, { previousFacilities: [], successor: null });

const washington = await loadAddressHistory({
  facilityId: "00000000-0000-4000-8000-000000000002",
  stateCode: "WA",
  stateSlug: "washington",
  licenseStatus: "LICENSED",
  licenseStatusDetail: null,
});
assert.deepEqual(washington, { previousFacilities: [], successor: null });

writeFileSync("/tmp/previous-facility-section.html", html);
console.log("test_address_successor: ok");
}

main();
