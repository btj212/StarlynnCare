import assert from "node:assert/strict";
import {
  CA_DEMENTIA_CLIENT_LABEL,
  MEMORY_CARE_BASIS_UNRECORDED,
  WA_AFH_ACCEPTS_DEMENTIA_BASIS,
  WA_AFH_NO_MC_BASIS,
  WA_NO_DEMENTIA_DESIGNATION,
  WA_OPERATOR_PROGRAM_LABEL,
  WA_TOLD_US_ACCEPTS_BASIS,
  dementiaAcceptanceTier,
  hasCaDementiaClientCode,
  memoryCareBasis,
  waCredentialFaqAnswer,
  waToldUsFaqAnswer,
} from "../src/lib/facility/memoryCareBasis.ts";
import { buildFacilityTitle } from "../src/lib/seo/meta.ts";
import {
  waMcSignalsFromRow,
  waMcSignalsHaveAny,
} from "../src/components/facility/profile/WaMcSignalBadges.tsx";
import { AZ_MC_LEVEL1_LABEL, azMcProgram } from "../src/lib/facility/azMcProgram.ts";
import { buildFacilityFaqPairs } from "../src/lib/seo/schema.ts";
import { formatRecordDate } from "../src/lib/format/formatRecordDate.ts";

assert.equal(formatRecordDate("2026-10-22"), "October 22, 2026");
assert.equal(formatRecordDate("2026-10-22T18:00:00Z"), "October 22, 2026");

const az = memoryCareBasis({
  state_code: "AZ",
  memory_care_disclosure_source: "ADHS Directed Care License",
});
assert.equal(az.recorded, true);
assert.equal(az.kind, "memory-care");
assert.equal(az.label, AZ_MC_LEVEL1_LABEL);
assert.match(az.label, /R9-10-816/);
assert.doesNotMatch(az.label, /Memory Care subclass/);
assert.equal(azMcProgram({}).confirmed, false);
assert.equal(azMcProgram({ mc_program_confirmed: false }).confirmed, false);
const confirmed = azMcProgram({
  mc_program_confirmed: true,
  mc_program_source_url: "https://example.com/mesa-memory-care",
  mc_program_quote: "Secure memory care neighborhood",
  mc_program_checked_at: "2026-11-26T18:00:00Z",
});
assert.equal(confirmed.confirmed, true);
assert.equal(confirmed.sourceUrl, "https://example.com/mesa-memory-care");
assert.equal(confirmed.checkedOn, "2026-11-26");
assert.equal(az.quote, null);
assert.match(az.sourceUrl ?? "", /azcarecheck/);

const azSubclassColumn = memoryCareBasis({
  state_code: "AZ",
  az_mc_subclass: true,
});
assert.equal(azSubclassColumn.kind, "memory-care");
assert.match(azSubclassColumn.label, /R9-10-816/);
assert.doesNotMatch(azSubclassColumn.label, /subclass/);

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

const citedOnDeficiency = memoryCareBasis({
  state_code: "CA",
  memory_care_disclosure_source: null,
  memory_care_designation: null,
  caCitationTexts: ["87705(a)(1)", "Care staff did not complete dementia training."],
});
assert.equal(citedOnDeficiency.recorded, true);
assert.match(citedOnDeficiency.label, /87705 or 87706/);

const caDisclosureFiled = memoryCareBasis({
  state_code: "CA",
  memory_care_disclosure_filed: true,
});
assert.equal(caDisclosureFiled.recorded, true);
assert.match(caDisclosureFiled.label, /1569\.627/);

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
assert.equal(waContract.kind, "memory-care");
assert.match(waContract.label, /dementia care contract/);

const waAfhSpecialtyOnly = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "AFH",
  wa_dementia_specialty: true,
  serves_memory_care: true,
});
assert.equal(waAfhSpecialtyOnly.kind, "none");
assert.equal(waAfhSpecialtyOnly.label, WA_AFH_ACCEPTS_DEMENTIA_BASIS);
assert.equal(dementiaAcceptanceTier({
  state_code: "WA",
  wa_facility_type: "AFH",
  wa_dementia_specialty: true,
  serves_memory_care: true,
}), "credential");
assert.doesNotMatch(waAfhSpecialtyOnly.label, /specialty/);

const waAfhOperator = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "AFH",
  wa_dementia_specialty: true,
  mc_program_confirmed: true,
  mc_program_source_url: "https://x",
});
assert.equal(waAfhOperator.kind, "memory-care");
assert.equal(waAfhOperator.label, WA_OPERATOR_PROGRAM_LABEL);
assert.equal(dementiaAcceptanceTier({
  state_code: "WA",
  wa_facility_type: "AFH",
  wa_dementia_specialty: true,
  mc_program_confirmed: true,
  mc_program_source_url: "https://x",
}), "memory-care");

const waAfhPlain = {
  state_code: "WA",
  wa_facility_type: "AFH",
  wa_dementia_specialty: false,
  serves_memory_care: true,
};
assert.equal(memoryCareBasis(waAfhPlain).label, WA_AFH_NO_MC_BASIS);
assert.equal(dementiaAcceptanceTier(waAfhPlain), "neither");

assert.equal(dementiaAcceptanceTier({
  state_code: "WA",
  wa_facility_type: "ALF",
  wa_dementia_specialty: true,
  serves_memory_care: true,
}), "neither");
const toldUs = {
  state_code: "WA" as const,
  wa_facility_type: "ALF",
  mc_designation_type: "accepts_dementia_no_secured_unit",
  mc_program_quote: "We don't have a dementia unit. We do have dementia residents. (2026-11-27)",
};
assert.equal(dementiaAcceptanceTier(toldUs), "confirmed-accepts");
assert.equal(memoryCareBasis(toldUs).kind, "none");
assert.equal(memoryCareBasis(toldUs).label, WA_TOLD_US_ACCEPTS_BASIS);
assert.equal(dementiaAcceptanceTier({ ...toldUs, mc_program_quote: "   " }), "neither");
assert.equal(dementiaAcceptanceTier({
  ...toldUs,
  mc_program_quote: null,
  mc_review_notes: "Phone call 2026-11-27 with Maria.",
}), "confirmed-accepts");
assert.equal(dementiaAcceptanceTier({
  ...toldUs,
  wa_memory_care_certified: true,
}), "memory-care");
assert.match(memoryCareBasis({ ...toldUs, wa_memory_care_certified: true }).label, /memory-care certified/);
const toldUsAfh = { ...toldUs, wa_facility_type: "AFH", wa_dementia_specialty: true };
assert.equal(dementiaAcceptanceTier(toldUsAfh), "confirmed-accepts");
assert.equal(memoryCareBasis(toldUsAfh).label, WA_TOLD_US_ACCEPTS_BASIS);
const toldSignals = waMcSignalsFromRow(toldUs);
assert.equal(toldSignals.acceptsDementia, true);
assert.equal(toldSignals.dementiaCredential, false);
assert.equal(toldSignals.memoryCare, false);
assert.equal(toldSignals.sdcp, false);
const toldCertified = waMcSignalsFromRow({ ...toldUs, wa_memory_care_certified: true });
assert.equal(toldCertified.memoryCare, true);
assert.equal(toldCertified.acceptsDementia, false);

const waAlfCertified = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "ALF",
  wa_memory_care_certified: true,
  wa_dementia_specialty: true,
});
assert.equal(waAlfCertified.kind, "memory-care");
assert.match(waAlfCertified.label, /memory-care certified/);
assert.equal(dementiaAcceptanceTier({
  state_code: "WA",
  wa_facility_type: "ALF",
  wa_memory_care_certified: true,
  wa_dementia_specialty: true,
}), "memory-care");

const regency = memoryCareBasis({
  state_code: "WA",
  wa_facility_type: "ALF",
  wa_dementia_specialty: true,
  serves_memory_care: false,
});
assert.equal(regency.kind, "none");
assert.equal(regency.label, WA_NO_DEMENTIA_DESIGNATION);
assert.doesNotMatch(regency.label, /dementia specialty/);

const afhSignals = waMcSignalsFromRow({
  wa_memory_care_certified: false,
  wa_earc_sdc_contracted: false,
  wa_dementia_care_contract: false,
  wa_facility_type: "AFH",
  wa_dementia_specialty: true,
  cms_overall_rating: null,
});
assert.equal("dementiaSpecialty" in afhSignals, false);
assert.equal(JSON.stringify(afhSignals).includes("Dementia Specialty"), false);
assert.equal(afhSignals.acceptsDementia, false);
assert.equal(afhSignals.dementiaCredential, true);
assert.equal(afhSignals.memoryCare, false);
assert.equal(waMcSignalsHaveAny(afhSignals), true);
const mccSignals = waMcSignalsFromRow({
  wa_memory_care_certified: true,
  wa_facility_type: "ALF",
  wa_dementia_specialty: true,
});
assert.equal(mccSignals.memoryCare, true);
assert.equal(mccSignals.acceptsDementia, false);

const waContractTypes = memoryCareBasis({
  state_code: "WA",
  wa_contract_types: ["Specialized Dementia Care"],
});
assert.equal(waContractTypes.kind, "memory-care");

const southHill = memoryCareBasis({
  state_code: "WA",
  serves_memory_care: false,
});
assert.equal(southHill.recorded, false);
assert.equal(southHill.kind, "none");
assert.equal(southHill.label, WA_NO_DEMENTIA_DESIGNATION);
assert.doesNotMatch(southHill.label, /not yet recorded/);

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
  lastInspectionIsComplaint: false,
  seriousFindings: [{ label: "IJ", count: 1 }],
  percentile: 80,
  memoryCareLabel: MEMORY_CARE_BASIS_UNRECORDED,
  licenseNumber: "F23",
  licenseUrl: "https://ccl.utah.gov",
  regulatorName: utah.regulator,
  regulatorAbbr: "DLBC",
});

assert.equal(pairs.some((pair) => pair.q.includes("tour")), false);
assert.equal(pairs[0].a, MEMORY_CARE_BASIS_UNRECORDED);
assert.match(pairs.find((pair) => pair.q.startsWith("When was"))?.a ?? "", /September 23, 2026/);
assert.match(pairs.find((pair) => pair.q.startsWith("When was"))?.a ?? "", /annual compliance visit/);
assert.match(pairs.find((pair) => pair.q.startsWith("Has "))?.a ?? "", /4 deficiencies from DLBC in the last three years/);
assert.match(pairs.find((pair) => pair.q.startsWith("How many"))?.a ?? "", /last three years/);
assert.match(pairs.find((pair) => pair.q.startsWith("How many"))?.a ?? "", /immediate jeopardy/);
assert.match(pairs.find((pair) => pair.q.startsWith("Who licenses"))?.a ?? "", /F23/);
assert.match(pairs.find((pair) => pair.q.startsWith("Who licenses"))?.a ?? "", /ccl\.utah\.gov/);
assert.match(pairs.find((pair) => pair.q.startsWith("How does"))?.a ?? "", /top 20%/);
assert.doesNotMatch(
  pairs.find((pair) => pair.q.startsWith("How does"))?.a ?? "",
  /Utah memory care facilities/,
);

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
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "Washington DSHS lists a dementia care contract for this home.",
  licenseNumber: null,
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
});
assert.equal(thin.length, 1);
assert.match(thin[0].a, /dementia care contract/);

const noMcFaq = buildFacilityFaqPairs({
  facilityName: "South Hill Village",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/spokane/south-hill-village",
  inspectionCount: 1,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: "2026-04-01",
  lastInspectionType: "inspection",
  lastInspectionIsComplaint: false,
  lastInspectionPrecision: "month",
  seriousFindings: [],
  percentile: 62,
  memoryCareLabel: WA_NO_DEMENTIA_DESIGNATION,
  servesMemoryCare: false,
  licenseNumber: "2480",
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
});
assert.equal(noMcFaq.some((pair) => pair.q.includes("provide memory care")), false);

const afhFaq = buildFacilityFaqPairs({
  facilityName: "Amazing Hearts AFH",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/vancouver/amazing-hearts-afh",
  inspectionCount: 0,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: null,
  lastInspectionType: null,
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: waAfhSpecialtyOnly.label,
  servesMemoryCare: false,
  dementiaCredentialAnswer: waCredentialFaqAnswer("Amazing Hearts AFH"),
  licenseNumber: "756545",
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
});
assert.equal(afhFaq.some((pair) => /provide memory care/i.test(pair.q)), false);

const toldFaq = buildFacilityFaqPairs({
  facilityName: "Amber Hills Assisted Living",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/prosser/amber-hills",
  inspectionCount: 0,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: null,
  lastInspectionType: null,
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: WA_TOLD_US_ACCEPTS_BASIS,
  servesMemoryCare: false,
  acceptsDementiaAnswer: waToldUsFaqAnswer("Amber Hills Assisted Living"),
  licenseNumber: "2616",
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
});
assert.equal(toldFaq.some((pair) => /provide memory care/i.test(pair.q)), false);
assert.equal(
  toldFaq.find((pair) => pair.q.startsWith("Does "))?.a,
  waToldUsFaqAnswer("Amber Hills Assisted Living"),
);
const toldTitle = buildFacilityTitle({
  name: "Amber Hills",
  stateName: "Washington",
  stateCode: "WA",
  waFacilityType: "ALF",
  dementiaTier: "confirmed-accepts",
  percentile: null,
  city: "Prosser",
  citationCount: 0,
  inspectionCount: 0,
  reviewCount: 0,
});
assert.equal(toldTitle.includes("Memory Care"), false);
assert.equal(toldTitle, "Amber Hills, Prosser: Assisted Living, Accepts Dementia");
const credentialFaq = afhFaq.find((pair) => pair.q === "Does Amazing Hearts AFH have a dementia credential?");
assert.equal(credentialFaq?.a, waCredentialFaqAnswer("Amazing Hearts AFH"));
assert.match(credentialFaq?.a ?? "", /staff-training credential/);
assert.doesNotMatch(credentialFaq?.a ?? "", /provide memory care/);
assert.equal(afhFaq.some((pair) => /accept residents with dementia\?/i.test(pair.q)), false);

const afhTitle = buildFacilityTitle({
  name: "Amazing Hearts AFH LLC",
  stateName: "Washington",
  stateCode: "WA",
  waFacilityType: "AFH",
  dementiaTier: "credential",
  percentile: null,
  city: "Vancouver",
  citationCount: 0,
  inspectionCount: 0,
  reviewCount: 0,
});
assert.equal(afhTitle.includes("Memory Care"), false);
assert.match(afhTitle, /Adult Family Home/);
assert.doesNotMatch(afhTitle, /Accepts Dementia/);
assert.doesNotMatch(afhTitle, /Dementia Credential/);
const shortCredentialTitle = buildFacilityTitle({
  name: "Ada Home",
  stateName: "Washington",
  stateCode: "WA",
  waFacilityType: "AFH",
  dementiaTier: "credential",
  percentile: null,
  city: "Vancouver",
  citationCount: 0,
  inspectionCount: 0,
  reviewCount: 0,
});
assert.equal(shortCredentialTitle.includes("Memory Care"), false);
assert.equal(shortCredentialTitle, "Ada Home, Vancouver: Adult Family Home, Dementia Credential");

const securedOmitted = buildFacilityFaqPairs({
  facilityName: "Amazing Hearts AFH",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/vancouver/amazing-hearts",
  inspectionCount: 0,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: null,
  lastInspectionType: null,
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "No dementia designation on the DSHS roster.",
  servesMemoryCare: false,
  licenseNumber: "1",
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
  waMemoryCareCertified: null,
});
assert.equal(securedOmitted.some((pair) => /secured memory-care unit/.test(pair.q)), false);
const toldNoUnit = buildFacilityFaqPairs({
  facilityName: "Amber Hills Assisted Living",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/prosser/amber-hills",
  inspectionCount: 0,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: null,
  lastInspectionType: null,
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "The home told StarlynnCare it accepts residents with dementia.",
  servesMemoryCare: false,
  licenseNumber: "2616",
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
  mcDesignationType: "accepts_dementia_no_secured_unit",
  mcProgramQuote: "We do have dementia residents.",
});
assert.equal(
  toldNoUnit.find((pair) => /secured memory-care unit/.test(pair.q))?.a,
  "No secured unit is on file.",
);
const mccYes = buildFacilityFaqPairs({
  facilityName: "Cogir of Glenwood Place",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/vancouver/cogir",
  inspectionCount: 1,
  deficiencyCount: 0,
  countsCoverThreeYears: false,
  lastInspectionDate: "2024-04-01",
  lastInspectionType: "inspection",
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "Memory Care Certified.",
  servesMemoryCare: true,
  licenseNumber: "2645",
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
  waMemoryCareCertified: true,
  mcDesignationType: null,
  mcProgramQuote: null,
});
assert.match(
  mccYes.find((pair) => /secured memory-care unit/.test(pair.q))?.a ?? "",
  /Memory Care Certified/,
);

const sdcFaq = buildFacilityFaqPairs({
  facilityName: "Example SDC Home",
  stateName: "Washington",
  stateCode: "WA",
  pageUrl: "https://www.starlynncare.com/washington/seattle/example-sdc",
  inspectionCount: 2,
  deficiencyCount: 1,
  countsCoverThreeYears: false,
  lastInspectionDate: "2026-04-01",
  lastInspectionType: "inspection",
  lastInspectionIsComplaint: false,
  seriousFindings: [],
  percentile: null,
  memoryCareLabel: "Washington DSHS lists a specialized dementia care contract for this home.",
  servesMemoryCare: true,
  licenseNumber: "1739",
  licenseUrl: null,
  regulatorName: "Washington DSHS",
  regulatorAbbr: "DSHS",
});
assert.equal(sdcFaq.some((pair) => /provide memory care/i.test(pair.q)), true);
assert.match(
  noMcFaq.find((pair) => pair.q.startsWith("How does"))?.a ?? "",
  /Washington assisted living/,
);
assert.doesNotMatch(
  noMcFaq.find((pair) => pair.q.startsWith("How does"))?.a ?? "",
  /memory care facilities/,
);
assert.match(noMcFaq.find((pair) => pair.q.startsWith("When was"))?.a ?? "", /in April 2026/);

const coloradoName = memoryCareBasis({
  state_code: "CO",
  memory_care_disclosure_source: "name indicates memory care",
});
assert.equal(coloradoName.recorded, false);
assert.equal(coloradoName.label, MEMORY_CARE_BASIS_UNRECORDED);

const coloradoPlain = memoryCareBasis({ state_code: "CO" });
assert.equal(coloradoPlain.recorded, false);
assert.equal(coloradoPlain.regulatorShort, "CDPHE");

const coloradoNursing = memoryCareBasis({
  state_code: "CO",
  co_care_setting: "NH",
  source_url: "https://www.medicare.gov/care-compare/details/nursing-home/065266",
});
assert.equal(coloradoNursing.recorded, false);
assert.equal(coloradoNursing.regulatorShort, "CMS");
assert.match(coloradoNursing.sourceUrl ?? "", /medicare\.gov/);

console.log("memory care basis checks passed");

// CA: CDSS client type 983 (RCFE / DEMENTIA) is a recorded basis; 935 is not.
const ca983 = memoryCareBasis({
  state_code: "CA",
  ca_cdss_client_served: ["935 - ELDERLY", "983 - RCFE / DEMENTIA", "985 - RCFE / HOSPICE"],
  ca_cdss_client_served_checked_at: "2026-11-26T16:00:00Z",
});
assert.equal(ca983.recorded, true);
assert.equal(ca983.kind, "memory-care");
assert.equal(ca983.label, CA_DEMENTIA_CLIENT_LABEL);
assert.equal(ca983.checkedOn, "2026-11-26");
const ca935 = memoryCareBasis({ state_code: "CA", ca_cdss_client_served: ["935 - ELDERLY"] });
assert.equal(ca935.recorded, false);
assert.equal(ca935.label, MEMORY_CARE_BASIS_UNRECORDED);
assert.equal(hasCaDementiaClientCode(["9830 - OTHER"]), false);
assert.equal(hasCaDementiaClientCode(["985 - RCFE / HOSPICE"]), false);
assert.equal(hasCaDementiaClientCode(null), false);
// 983 on a non-CA row does not count.
assert.equal(memoryCareBasis({ state_code: "TX", ca_cdss_client_served: ["983 - RCFE / DEMENTIA"] }).recorded, false);
// A §87705 citation source still wins over the client code.
const caCited = memoryCareBasis({
  state_code: "CA",
  memory_care_disclosure_source: "§87705/§87706 citation",
  ca_cdss_client_served: ["983 - RCFE / DEMENTIA"],
});
assert.match(caCited.label, /87705/);
console.log("ca client-served basis tests ok");
