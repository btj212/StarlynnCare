import assert from "node:assert/strict";
import {
  facilityListedInSitemap,
  facilityMarkedNoindex,
} from "../src/lib/seo/indexability.ts";

type Case = {
  name: string;
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
  reviewCount: number;
  tourQuestionCount: number;
  photoCount: number;
  noindex: boolean;
  listed: boolean;
};

const cases: Case[] = [
  {
    name: "a cited Arizona home stays indexable even at 6 beds",
    stateCode: "AZ",
    beds: 6,
    deficiencyCount: 2,
    inspectionCount: 3,
    reviewCount: 0,
    tourQuestionCount: 0,
    photoCount: 0,
    noindex: false,
    listed: true,
  },
  {
    name: "unknown beds are not treated as a small home",
    stateCode: "IL",
    beds: null,
    deficiencyCount: 0,
    inspectionCount: 2,
    reviewCount: 0,
    tourQuestionCount: 0,
    photoCount: 0,
    noindex: false,
    listed: true,
  },
  {
    name: "a small Arizona home with no citations is excluded",
    stateCode: "AZ",
    beds: 8,
    deficiencyCount: 0,
    inspectionCount: 1,
    reviewCount: 0,
    tourQuestionCount: 0,
    photoCount: 1,
    noindex: true,
    listed: false,
  },
  {
    name: "a small uncited home outside Arizona stays indexable",
    stateCode: "OR",
    beds: 6,
    deficiencyCount: 0,
    inspectionCount: 2,
    reviewCount: 0,
    tourQuestionCount: 0,
    photoCount: 0,
    noindex: false,
    listed: true,
  },
  {
    name: "an inspected home with no narrative stays indexable",
    stateCode: "WA",
    beds: 40,
    deficiencyCount: 0,
    inspectionCount: 4,
    reviewCount: 0,
    tourQuestionCount: 0,
    photoCount: 0,
    noindex: false,
    listed: true,
  },
  {
    name: "a page with no record at all is noindex and unlisted",
    stateCode: "TX",
    beds: 80,
    deficiencyCount: 0,
    inspectionCount: 0,
    reviewCount: 0,
    tourQuestionCount: 0,
    photoCount: 0,
    noindex: true,
    listed: false,
  },
  {
    name: "a photo-only home can be indexed but is not requested in the sitemap",
    stateCode: "CA",
    beds: 20,
    deficiencyCount: 0,
    inspectionCount: 0,
    reviewCount: 0,
    tourQuestionCount: 0,
    photoCount: 2,
    noindex: false,
    listed: false,
  },
];

for (const item of cases) {
  const noindex = facilityMarkedNoindex(item);
  const listed = facilityListedInSitemap(item);
  assert.equal(noindex, item.noindex, `${item.name}: noindex`);
  assert.equal(listed, item.listed, `${item.name}: sitemap`);
  assert.equal(noindex && listed, false, `${item.name}: noindex must not be listed`);
}

console.log("indexability checks passed");
