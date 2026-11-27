import assert from "node:assert/strict";
import {
  buildBreadcrumbList,
  buildDatasetSchema,
  buildFaqSchemaFromPairs,
  buildLocalBusinessForFacility,
} from "../src/lib/seo/schema.ts";
import { COVERED_STATES } from "../src/lib/states.ts";
import type { Facility } from "../src/lib/types.ts";
import { memoryCareBasis } from "../src/lib/facility/memoryCareBasis.ts";

const crumbs = buildBreadcrumbList([
  { name: "Home", url: "https://www.starlynncare.com/" },
  { name: "Arizona memory care", url: "https://www.starlynncare.com/arizona" },
]) as { "@type": string; itemListElement: unknown[] };
assert.equal(crumbs["@type"], "BreadcrumbList");
assert.equal(crumbs.itemListElement.length, 2);

const dataset = buildDatasetSchema({
  pageUrl: "https://www.starlynncare.com/data",
  methodologyUrl: "https://www.starlynncare.com/methodology",
}) as { "@type": string; name: string; spatialCoverage: unknown[] };
assert.equal(dataset["@type"], "Dataset");
assert.match(dataset.name, /11 States/);
assert.equal(dataset.spatialCoverage.length, COVERED_STATES.length);
assert.equal(JSON.stringify(dataset).includes("California only"), false);

const faqs = buildFaqSchemaFromPairs(
  [{ q: "Where is the lookup?", a: "On the state portal." }],
  "https://www.starlynncare.com/arizona",
) as { "@type": string; mainEntity: unknown[] };
assert.equal(faqs["@type"], "FAQPage");
assert.equal(faqs.mainEntity.length, 1);

const facility = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "LEGACY RETIREMENT RESIDENCE",
  marketing_name: "Legacy House of Mesa",
  slug: "legacy-retirement-residence",
  city: "Mesa",
  city_slug: "mesa",
  state_code: "AZ",
  street: "123 Main St",
  zip: "85201",
  phone: "4805550100",
  license_number: "AL0001",
  care_category: "alf_memory_care",
  beds: 80,
  latitude: "33.4",
  longitude: "-111.8",
} as unknown as Facility;

const local = buildLocalBusinessForFacility(facility, {
  code: "AZ",
  slug: "arizona",
  name: "Arizona",
}, { canonicalUrl: "https://www.starlynncare.com/arizona/mesa/legacy-retirement-residence" }) as {
  "@type": string | string[];
  name: string;
  legalName?: string;
  telephone?: string;
  identifier?: { value: string };
  address: { streetAddress?: string };
};
const types = Array.isArray(local["@type"]) ? local["@type"] : [local["@type"]];
assert.equal(types.includes("LocalBusiness"), true);
assert.equal(local.name, "Legacy House of Mesa");
assert.equal(local.legalName, "Legacy Retirement Residence");
assert.equal(local.telephone, "4805550100");
assert.equal(local.identifier?.value, "AL0001");
assert.equal(local.address.streetAddress, "123 Main St");
assert.equal(JSON.stringify(local).includes("priceRange"), false);

const snf = buildLocalBusinessForFacility(
  { ...facility, care_category: "snf_general", marketing_name: null } as unknown as Facility,
  { code: "CO", slug: "colorado", name: "Colorado" },
  { canonicalUrl: "https://www.starlynncare.com/colorado/denver/example-snf" },
) as { "@type": string | string[] };
const snfTypes = Array.isArray(snf["@type"]) ? snf["@type"] : [snf["@type"]];
assert.equal(snfTypes.includes("NursingHome"), true);

const parkland = buildLocalBusinessForFacility(
  {
    ...facility,
    city: "Parkland",
    city_slug: "parkland",
    state_code: "WA",
    historical_city_slugs: ["tacoma"],
  } as unknown as Facility,
  { code: "WA", slug: "washington", name: "Washington" },
  { canonicalUrl: "https://www.starlynncare.com/washington/parkland/example" },
) as { address: { addressLocality?: string } };
assert.equal(parkland.address.addressLocality, "Tacoma");

const waState = { code: "WA", slug: "washington", name: "Washington" };
const waHome = {
  ...facility,
  name: "AMAZING HEARTS AFH",
  marketing_name: null,
  city: "Vancouver",
  city_slug: "vancouver",
  state_code: "WA",
  license_number: "756545",
  care_category: "alf_general",
} as unknown as Facility;
const afhOnly = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "AFH",
  wa_dementia_specialty: true,
  serves_memory_care: true,
});
const afhLd = buildLocalBusinessForFacility(waHome, waState, {
  canonicalUrl: "https://www.starlynncare.com/washington/vancouver/amazing-hearts-afh",
  memoryCare: afhOnly,
}) as {
  amenityFeature?: Array<{ name: string }>;
  additionalProperty?: Array<{ name: string }>;
};
assert.equal(afhLd.amenityFeature, undefined);
assert.equal(
  (afhLd.additionalProperty ?? []).some((prop) => prop.name === "Memory care basis"),
  false,
);

const mccLd = buildLocalBusinessForFacility(waHome, waState, {
  canonicalUrl: "https://www.starlynncare.com/washington/vancouver/amazing-hearts-afh",
  memoryCare: memoryCareBasis({
    state_code: "WA",
    wa_facility_type: "ALF",
    wa_memory_care_certified: true,
  }),
}) as { amenityFeature?: Array<{ name: string }> };
assert.equal(mccLd.amenityFeature?.[0]?.name, "Memory care");

console.log("json-ld builder checks passed");
