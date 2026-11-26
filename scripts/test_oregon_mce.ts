import assert from "node:assert/strict";
import { memoryCareBasis } from "../src/lib/facility/memoryCareBasis.ts";

const endorsed = memoryCareBasis({
  state_code: "OR",
  mce_endorsed: true,
  mce_evidence: "CSS portal lists a memory care endorsement.",
});
assert.equal(endorsed.recorded, true);
assert.match(endorsed.label, /Oregon DHS lists a memory care endorsement/);

const notEndorsed = memoryCareBasis({
  state_code: "OR",
  mce_endorsed: false,
});
assert.equal(notEndorsed.recorded, false);

const leftoverColumn = {
  state_code: "OR",
  or_memory_care_endorsed: true,
} as Parameters<typeof memoryCareBasis>[0] & { or_memory_care_endorsed: boolean };
assert.equal(memoryCareBasis(leftoverColumn).recorded, false);

console.log("test_oregon_mce: ok");
