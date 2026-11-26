import type { CaMemoryCareDesignationBasis } from "@/lib/types";
import { regulatorFor } from "@/lib/states/regulators";
import { AZ_MC_LEVEL1_LABEL } from "@/lib/facility/azMcProgram";

/**
 * Why a published home is listed as memory care, using only a state file
 * we already store. A name match, a chain note, or a manual review is not
 * a state file. Oregon's `mce_evidence` is quoted only when it is a
 * sentence. Ingest tokens such as `providers_csv` are not printed.
 */
export type MemoryCareBasisKind = "none" | "care-level" | "memory-care";

export type MemoryCareBasis = {
  recorded: boolean;
  /**
   * `memory-care` is a recorded dementia-care designation (OR endorsement,
   * WA SDC or AFH dementia specialty, CA dementia-care plan, AZ Directed
   * Care under A.A.C. R9-10-816, …).
   * `care-level` is a state file that is not that designation.
   */
  kind: MemoryCareBasisKind;
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
  memory_care_disclosure_filed?: boolean | null;
  /** Deficiency codes/descriptions from the inspection record (e.g. 87705). */
  caCitationTexts?: string[] | null;
  ca_memory_care_designation_basis?: CaMemoryCareDesignationBasis | null;
  /** CA: CDSS FacilityDetail CLIENTSERVED values, verbatim. Only 983 is a dementia basis. */
  ca_cdss_client_served?: string[] | null;
  ca_cdss_client_served_checked_at?: string | null;
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
  /** Unused column. HB2764 did not create a separate Memory Care subclass. */
  az_mc_subclass?: boolean | null;
  az_license_level?: string | null;
  state_records_checked_at?: string | null;
  /** Colorado care setting. Nursing homes are CMS-certified, not CDPHE-licensed. */
  co_care_setting?: "ALR" | "NH" | null;
  /** Official facility record. Used for a Colorado nursing home's Care Compare link. */
  source_url?: string | null;
};

const CA_CITATION =
  "California CDSS cited this home under the dementia-care rules, sections 87705 or 87706.";

export const AZ_DIRECTED_CARE_LABEL = AZ_MC_LEVEL1_LABEL;

const SOURCE_LABELS: Record<string, string> = {
  "ADHS Directed Care License": AZ_DIRECTED_CARE_LABEL,
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

/** CDSS client type 983 is "RCFE / DEMENTIA". 935 (ELDERLY) is not a basis. */
export const CA_DEMENTIA_CLIENT_CODE = "983";

export const CA_DEMENTIA_CLIENT_LABEL =
  "California CDSS lists this home's client type as 983 - RCFE / Dementia.";

export function hasCaDementiaClientCode(values: string[] | null | undefined): boolean {
  return (values ?? []).some((v) => {
    const code = v?.trim().split(/\s*-\s*/)[0];
    return code === CA_DEMENTIA_CLIENT_CODE;
  });
}

function hasCaDementiaRule(value: string | null | undefined): boolean {
  return /87705|87706/.test(value ?? "");
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
    kind: "none",
    label: MEMORY_CARE_BASIS_UNRECORDED,
    regulator: office?.long ?? "State regulator",
    regulatorShort: office?.short ?? "State",
    sourceUrl: office?.portalUrl ?? null,
    quote: null,
    checkedOn: facility.state_records_checked_at?.slice(0, 10) ?? null,
  };

  const recorded = (
    label: string,
    quote?: string | null,
    kind: MemoryCareBasisKind = "memory-care",
  ): MemoryCareBasis => ({
    ...basis,
    recorded: true,
    kind,
    label,
    quote: quote ?? null,
  });

  const source = facility.memory_care_disclosure_source?.trim() || null;

  // CDPHE licenses assisted living, but it does not publish a facility-level
  // Secure Environment roster. A name, a chain, or a directory listing is not
  // a state file. Show a basis only when that file is stored on the row.
  if (facility.state_code === "CO") {
    if (facility.co_care_setting === "NH") {
      const careCompare = facility.source_url?.trim();
      return {
        ...basis,
        regulator: "Centers for Medicare & Medicaid Services",
        regulatorShort: "CMS",
        sourceUrl:
          careCompare && careCompare.startsWith("http")
            ? careCompare
            : "https://www.medicare.gov/care-compare/",
      };
    }
    return basis;
  }

  if (source && !isManualReview(source) && source !== "PA DHS HSD bulk export") {
    if (source === "TX HHSC Alzheimer Certification") {
      return recorded(texasLabel(facility.tx_alzheimer_cert_no));
    }
    if (source === "ADHS Directed Care License") {
      return recorded(AZ_DIRECTED_CARE_LABEL);
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
  if (hasCaDementiaRule(designation)) {
    return recorded(CA_CITATION);
  }
  if ((facility.caCitationTexts ?? []).some((text) => hasCaDementiaRule(text))) {
    return recorded(CA_CITATION);
  }
  // CDSS §1569.627 disclosure is a state file. The live column
  // ca_memory_care_designation_basis was never applied, so this boolean is
  // the stored basis when the 87705 source string is missing.
  if (facility.state_code === "CA" && hasCaDementiaClientCode(facility.ca_cdss_client_served)) {
    return {
      ...recorded(CA_DEMENTIA_CLIENT_LABEL),
      checkedOn:
        facility.ca_cdss_client_served_checked_at?.slice(0, 10) ?? basis.checkedOn,
    };
  }
  if (facility.state_code === "CA" && facility.memory_care_disclosure_filed) {
    return recorded(
      "California CDSS has a dementia-care disclosure on file for this home under Health and Safety Code section 1569.627.",
    );
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
    return recorded("Washington DSHS lists a dementia specialty designation for this home.");
  }

  if (facility.tx_alzheimer_certified) {
    return recorded(texasLabel(facility.tx_alzheimer_cert_no));
  }
  if (facility.il_dementia_program_flag) {
    return recorded(
      "Illinois IDPH lists an Alzheimer's Special Care Program for this home on the LLCS facility lookup.",
    );
  }
  if (facility.mn_dementia_care_licensed) {
    return recorded("Minnesota licenses this home for assisted living with dementia care.");
  }
  if (facility.mo_alzheimer_scu) {
    return recorded("Missouri DHSS lists an Alzheimer's special care unit for this home.");
  }
  if (facility.az_memory_care_endorsed || facility.az_license_level === "Directed Care") {
    return recorded(AZ_DIRECTED_CARE_LABEL);
  }

  if (facility.state_code === "AZ") {
    return recorded(AZ_DIRECTED_CARE_LABEL);
  }

  return basis;
}
