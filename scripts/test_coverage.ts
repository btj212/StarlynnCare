import assert from "node:assert/strict";
import {
  classifyCoverage,
  coverageFaqAnswer,
  heroStateLine,
} from "../src/lib/coverage.ts";
import { buildNationalFaqs } from "../src/lib/content/stateFaqs.ts";

const coverage = classifyCoverage([
  { stateCode: "CA", facilityCount: 1200 },
  { stateCode: "OR", facilityCount: 400 },
  { stateCode: "WA", facilityCount: 300 },
  { stateCode: "MN", facilityCount: 200 },
  { stateCode: "UT", facilityCount: 150 },
  { stateCode: "IL", facilityCount: 180 },
  { stateCode: "PA", facilityCount: 220 },
  { stateCode: "AZ", facilityCount: 500 },
  { stateCode: "MO", facilityCount: 250 },
  { stateCode: "TX", facilityCount: 1 },
  { stateCode: "CO", facilityCount: 71 },
]);

assert.equal(coverage.indexedStateCount, 11);
assert.equal(coverage.liveStateCount, 9);
assert.equal(coverage.pilot.map((s) => s.code).join(","), "TX,CO");
assert.match(heroStateLine(coverage), /Pilot: TX \(1\) · CO \(71\)/);
assert.match(coverageFaqAnswer(coverage), /Texas \(1 home\)/);
assert.match(coverageFaqAnswer(coverage), /Colorado \(71 homes\)/);

const faqs = buildNationalFaqs(coverage);
const which = faqs.find((f) => f.q === "Which states do you cover?");
assert.ok(which);
assert.match(which.a, /California/);
assert.match(which.a, /Texas/);
assert.match(which.a, /Colorado/);
assert.equal(which.a.includes("only California"), false);

console.log("coverage checks passed");
