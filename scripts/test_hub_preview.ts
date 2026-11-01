import assert from "node:assert/strict";
import { rankHubFacilities } from "../src/lib/facility/hubPreview.ts";
import { displayCityName } from "../src/lib/resolveListingRegion.ts";

const ranked = rankHubFacilities([
  { name: "Tiny", inspections: 4, total_citations: 9, capacity_tier: "small" },
  { name: "Quiet", inspections: 0, total_citations: 0, capacity_tier: "large" },
  { name: "Cited", inspections: 2, total_citations: 6, capacity_tier: "medium" },
  { name: "Full", inspections: 5, total_citations: 1, capacity_tier: "large" },
]);

assert.deepEqual(
  ranked.preview.map((facility) => facility.name),
  ["Full", "Cited", "Quiet"],
);
assert.equal(ranked.onlySmallHomes, false);
assert.equal(ranked.itemList.length, 3);

const onlySmall = rankHubFacilities([
  { name: "B Home", inspections: 1, total_citations: 0, capacity_tier: "small" },
  { name: "A Home", inspections: 1, total_citations: 0, capacity_tier: "small" },
]);
assert.equal(onlySmall.onlySmallHomes, true);
assert.deepEqual(
  onlySmall.preview.map((facility) => facility.name),
  ["A Home", "B Home"],
);

assert.equal(displayCityName("PORTLAND", "portland"), "Portland");

console.log("hub preview checks passed");
