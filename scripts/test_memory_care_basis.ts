import assert from "node:assert/strict";
import {
  MEMORY_CARE_BASIS_UNRECORDED,
  memoryCareBasis,
} from "../src/lib/facility/memoryCareBasis.ts";
import { buildFacilityFaqPairs } from "../src/lib/seo/schema.ts";
import { formatRecordDate } from "../src/lib/format/formatRecordDate.ts";

assert.equal(formatRecordDate("2026-10-22"), "October 22, 2026");
assert.equal(formatRecordDate("2026-10-22T18:00:00Z"), "October 22, 2026");

const az = memoryCareBasis({
  state_code: "AZ",
  memory_care_disclosure_source: "ADHS Directed Care License",
});
assert.equal(az.recorded, true);
assert.equal(az.label, "Arizona lists this home under a Directed Care license.");
assert.equal(az.quote, null);
assert.match(az.sourceUrl ?? "", /azcarecheck/);

const manual = memoryCareBasis({
  state_code: "CA",
  memory_care_disclosure_source: "manual review — known MC chain operator",
});
assert.equal(manual.recorded, false);
assert.equal(manual.label, MEMORY_CARE_BASIS_UNRECORDED);

const cited = memoryCareBasis({
  state_code: "CA",
  memory_care_disclosure_source: "§87705/§87706 citation",
});
assert.match(cited.label, /87705 or 87706/);

const nameOnly = memoryCareBasis({
  state_code: "IL",
  memory_care_designation: "name indicates memory care",
});
assert.equal(nameOnly.recorded, false);

const ilProgram = memoryCareBasis({
  state_code: "IL",
  il_dementia_program_flag: true,
});
assert.equal(ilProgram.recorded, true);
assert.match(ilProgram.label, /IDPH/);

const oregon = memoryCareBasis({
  state_code: "OR",
  mce_endorsed: true,
  mce_evidence: "providers_csv",
});
assert.equal(oregon.recorded, true);
assert.equal(oregon.quote, null);
assert.match(oregon.label, /ORS 443.886/);

const oregonHint = memoryCareBasis({
  state_code: "OR",
  mce_endorsed: false,
  mce_evidence: "name hint",
});
assert.equal(oregonHint.recorded, false);

const oregonSentence = memoryCareBasis({
  state_code: "OR",
  mce_endorsed: true,
  mce_evidence: "Endorsement listed on the Oregon public record for this license.",
});
assert.equal(
  oregonSentence.quote,
  "Endorsement listed on the Oregon public record for this license.",
);

const pa = memoryCareBasis({
  state_code: "PA",
  memory_care_disclosure_source: "PA DHS HSD bulk export",
  mc_designation_type: "Secure Dementia Care Unit",
});
assert.match(pa.label, /secure dementia care unit/);
assert.doesNotMatch(pa.label, /bulk export/);

const paBlank = memoryCareBasis({
  state_code: "PA",
  memory_care_disclosure_source: null,
  mc_designation_type: null,
});
assert.equal(paBlank.recorded, false);

const utah = memoryCareBasis({ state_code: "UT" });
assert.equal(utah.recorded, false);
assert.match(utah.regulator, /Licensing and Background Checks/);

const texas = memoryCareBasis({
  state_code: "TX",
  memory_care_disclosure_source: "TX HHSC Alzheimer Certification",
  tx_alzheimer_certified: true,
  tx_alzheimer_cert_no: "104313",
});
assert.match(texas.label, /104313/);

const waChecked = memoryCareBasis({
  state_code: "WA",
  state_records_checked_at: "2026-10-28T15:04:00Z",
});
assert.equal(waChecked.checkedOn, "2026-10-28");
assert.equal(waChecked.recorded, false);

const waContract = memoryCareBasis({
  state_code: "WA",
  memory_care_disclosure_source: "WA DSHS Dementia Care Contract",
});
assert.match(waContract.label, /dementia care contract/);

const pairs = buildFacilityFaqPairs({
  facilityName: "Example Home",
  stateName: "Utah",
  stateCode: "UT",
  pageUrl: "https://www.starlynncare.com/utah/west-jordan/example",
  inspectionCount: 2,
  deficiencyCount: 4,
  countsCoverThreeYears: true,
  lastInspectionDate: "2026-09-23",
  lastInspectionType: "annual",
  seriousFindings: [{ label: "IJ", count: 1 }],
  percentile: 80,
  memoryCareLabel: MEMORY_CARE_BASIS_UNRECORDED,
  licenseNumber: "F23",
  licenseUrl: "https://ccl.utah.gov",
  regulatorName: utah.regulator,
});

assert.equal(pairs.some((pair) => pair.q.includes("tour")), false);
assert.equal(pairs[0].a, MEMORY_CARE_BASIS_UNRECORDED);
assert.match(pairs.find((pair) => pair.q.startsWith("When was"))?.a ?? "", /September 23, 2026/);
assert.match(pairs.find((pair) => pair.q.startsWith("When was"))?.a ?? "", /annual inspection/);
assert.match(pairs.find((pair) => pair.q.startsWith("How many"))?.a ?? "", /last three years/);
assert.match(pairs.find((pair) => pair.q.startsWith("How many"))?.a ?? "", /immediate jeopardy/);
assert.match(pairs.find((pair) => pair.q.startsWith("Who licenses"))?.a ?? "", /F23/);
assert.match(pairs.find((pair) => pair.q.startsWith("Who licenses"))?.a ?? "", /ccl\.utah\.gov/);
assert.match(pairs.find((pair) => pair.q.startsWith("How does"))?.a ?? "", /top 20%/);

const thin = buildFacilityFaqPairs({
  facilityName: "Quiet Home",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/sequim/quiet",
  inspectionCount: 0,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: null,
  lastInspectionType: null,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "Washington DSHS lists a dementia care contract for this home.",
  licenseNumber: null,
  licenseUrl: null,
  regulatorName: "Washington DSHS",
});
assert.equal(thin.length, 1);
assert.match(thin[0].a, /dementia care contract/);

console.log("memory care basis checks passed");
