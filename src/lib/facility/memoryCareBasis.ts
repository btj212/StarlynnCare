import type { CaMemoryCareDesignationBasis } from "@/lib/types";
import { regulatorFor } from "@/lib/states/regulators";

/**
 * Why a published home is listed as memory care, using only a state file
 * we already store. A name match, a chain note, or a manual review is not
 * a state file. Oregon's `mce_evidence` is quoted only when it is a
 * sentence. Ingest tokens such as `providers_csv` are not printed.
 */
export type MemoryCareBasis = {
  recorded: boolean;
  label: string;
  /** Long office name for the source line. */
  regulator: string;
  regulatorShort: string;
  sourceUrl: string | null;
  quote: string | null;
  /** YYYY-MM-DD from state_records_checked_at, when that check has been stored. */
  checkedOn: string | null;
};

export const MEMORY_CARE_BASIS_UNRECORDED =
  "Memory-care basis not yet recorded from the state file.";

export type MemoryCareBasisInput = {
  state_code: string;
  memory_care_disclosure_source?: string | null;
  memory_care_designation?: string | null;
  ca_memory_care_designation_basis?: CaMemoryCareDesignationBasis | null;
  mc_designation_type?: string | null;
  mce_endorsed?: boolean | null;
  mce_evidence?: string | null;
  wa_memory_care_certified?: boolean | null;
  wa_earc_sdc_contracted?: boolean | null;
  wa_dementia_care_contract?: boolean | null;
  wa_dementia_specialty?: boolean | null;
  tx_alzheimer_certified?: boolean | null;
  tx_alzheimer_cert_no?: string | null;
  il_dementia_program_flag?: boolean | null;
  mn_dementia_care_licensed?: boolean | null;
  mo_alzheimer_scu?: boolean | null;
  az_memory_care_endorsed?: boolean | null;
  state_records_checked_at?: string | null;
};

const CA_CITATION =
  "California CDSS cited this home under the dementia-care rules, sections 87705 or 87706.";

const SOURCE_LABELS: Record<string, string> = {
  "ADHS Directed Care License": "Arizona lists this home under a Directed Care license.",
  "MN ALRC ALDC": "Minnesota licenses this home for assisted living with dementia care.",
  "§87705/§87706 citation": CA_CITATION,
  "DHSS Alzheimer's SCU Disclosure §198.510":
    "Missouri DHSS has an Alzheimer's special care unit disclosure on file under section 198.510.",
  "DHSS ALF** license (§198.073.6 RSMo)":
    "Missouri licenses this home as assisted living with an Alzheimer's special care disclosure under section 198.073.6.",
  "WA DSHS Dementia Care Contract": "Washington DSHS lists a dementia care contract for this home.",
};

/** Ingest tokens and review notes. Not sentences from a state file. */
const EVIDENCE_TOKENS = new Set([
  "providers_csv",
  "name hint",
  "name match",
  "css portal",
  "pra list",
]);

const CA_BASIS_LABEL: Record<CaMemoryCareDesignationBasis, string | null> = {
  self_identified: null,
  dementia_training_compliance: CA_CITATION,
  secured_perimeter: "A California inspection record notes a secured perimeter at this home.",
  hospice_waiver: "California records a hospice waiver for this home.",
  multiple: "California records more than one memory-care basis for this home.",
};

function isManualReview(source: string): boolean {
  return source.trim().toLowerCase().startsWith("manual review");
}

function proseQuote(evidence: string | null | undefined): string | null {
  const text = evidence?.trim();
  if (!text) return null;
  if (EVIDENCE_TOKENS.has(text.toLowerCase())) return null;
  if (text.length < 40 || !text.includes(" ")) return null;
  return text;
}

function texasLabel(certNo: string | null | undefined): string {
  const no = certNo?.trim();
  return no
    ? `Texas HHSC lists Alzheimer certification ${no} for this home.`
    : "Texas HHSC lists an Alzheimer certification for this home.";
}

export function memoryCareBasis(facility: MemoryCareBasisInput): MemoryCareBasis {
  const office = regulatorFor(facility.state_code);
  const basis: MemoryCareBasis = {
    recorded: false,
    label: MEMORY_CARE_BASIS_UNRECORDED,
    regulator: office?.long ?? "State regulator",
    regulatorShort: office?.short ?? "State",
    sourceUrl: office?.portalUrl ?? null,
    quote: null,
    checkedOn: facility.state_records_checked_at?.slice(0, 10) ?? null,
  };

  const recorded = (label: string, quote?: string | null): MemoryCareBasis => ({
    ...basis,
    recorded: true,
    label,
    quote: quote ?? null,
  });

  const source = facility.memory_care_disclosure_source?.trim() || null;
  if (source && !isManualReview(source) && source !== "PA DHS HSD bulk export") {
    if (source === "TX HHSC Alzheimer Certification") {
      return recorded(texasLabel(facility.tx_alzheimer_cert_no));
    }
    const known = SOURCE_LABELS[source];
    if (known) return recorded(known);
    return recorded(`The state file names this home's memory-care source as ${source}.`);
  }

  if (facility.mc_designation_type === "Secure Dementia Care Unit") {
    return recorded("Pennsylvania DHS lists this home as a secure dementia care unit.");
  }
  if (facility.mc_designation_type === "Special Care") {
    return recorded(
      "Pennsylvania DHS lists this home as special care, the assisted-living dementia designation.",
    );
  }

  const caBasis = facility.ca_memory_care_designation_basis;
  if (caBasis) {
    const label = CA_BASIS_LABEL[caBasis];
    if (label) return recorded(label);
  }

  const designation = facility.memory_care_designation ?? "";
  if (designation.includes("87705") || designation.includes("87706")) {
    return recorded(CA_CITATION);
  }

  if (facility.mce_endorsed) {
    return recorded(
      "Oregon DHS lists a memory care endorsement for this home under ORS 443.886.",
      proseQuote(facility.mce_evidence),
    );
  }

  if (facility.wa_memory_care_certified) {
    return recorded("Washington DSHS lists this home as memory-care certified.");
  }
  if (facility.wa_earc_sdc_contracted || facility.wa_dementia_care_contract) {
    return recorded("Washington DSHS lists a specialized dementia care contract for this home.");
  }
  if (facility.wa_dementia_specialty) {
    return recorded("Washington DSHS lists a dementia specialty for this home.");
  }

  if (facility.tx_alzheimer_certified) {
    return recorded(texasLabel(facility.tx_alzheimer_cert_no));
  }
  if (facility.il_dementia_program_flag) {
    return recorded("Illinois IDPH records a dementia program on this license.");
  }
  if (facility.mn_dementia_care_licensed) {
    return recorded("Minnesota licenses this home for assisted living with dementia care.");
  }
  if (facility.mo_alzheimer_scu) {
    return recorded("Missouri DHSS lists an Alzheimer's special care unit for this home.");
  }
  if (facility.az_memory_care_endorsed) {
    return recorded("Arizona lists this home under a Directed Care license.");
  }

  return basis;
}
