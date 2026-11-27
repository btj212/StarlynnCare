import { waToldUsAcceptsDementia, type MemoryCareBasisInput } from "@/lib/facility/memoryCareBasis";

/**
 * Medicaid / Medi-Cal FAQ sources. A state is listed only when a facilities
 * column literally records whether the home accepts that program. A null
 * value omits the question. There is no California Medi-Cal column and no
 * Washington DSHS accepts-Medicaid column. A contract name that mentions
 * Medicaid is not that flag.
 */
export const MEDICAID_FAQ_COLUMNS: ReadonlyArray<{
  state: string;
  column: string;
  program: "Medi-Cal" | "Medicaid";
}> = [{ state: "OR", column: "or_accepts_medicaid", program: "Medicaid" }];

export const MEDICAID_FAQ_OMITTED_STATES = [
  "CA",
  "WA",
  "AZ",
  "PA",
  "UT",
  "CO",
  "MN",
  "MO",
  "IL",
  "TX",
] as const;

/**
 * Secured-unit FAQ sources. Yes only when the column literally means a
 * secured or locked unit. A credential, an endorsement, or a directory
 * signal is not a yes.
 */
export const SECURED_UNIT_COLUMNS: ReadonlyArray<{ state: string; column: string }> = [
  { state: "PA", column: "mc_designation_type = 'Secure Dementia Care Unit'" },
  { state: "UT", column: "secure_beds > 0" },
  { state: "WA", column: "wa_memory_care_certified" },
  {
    state: "WA",
    column: "mc_designation_type = 'accepts_dementia_no_secured_unit' (quote or notes required)",
  },
];

export const NO_SECURED_UNIT_ON_FILE = "No secured unit is on file.";

export function medicaidFaqPair(input: {
  name: string;
  stateCode: string;
  orAcceptsMedicaid?: boolean | null;
}): { q: string; a: string } | null {
  if (input.stateCode !== "OR" || input.orAcceptsMedicaid == null) return null;
  const q = `Does ${input.name} accept Medicaid?`;
  const a = input.orAcceptsMedicaid
    ? `Yes. Oregon DHS lists ${input.name} as accepting Medicaid.`
    : `No. Oregon DHS does not list ${input.name} as accepting Medicaid.`;
  return { q, a };
}

export function securedUnitFaqPair(input: {
  name: string;
  stateCode: string;
  mcDesignationType?: string | null;
  secureBeds?: number | null;
  waMemoryCareCertified?: boolean | null;
  mcProgramQuote?: string | null;
  mcReviewNotes?: string | null;
}): { q: string; a: string } | null {
  const q = `Does ${input.name} have a secured memory-care unit?`;

  if (input.stateCode === "PA" && input.mcDesignationType === "Secure Dementia Care Unit") {
    return {
      q,
      a: `Yes. Pennsylvania DHS lists ${input.name} as a Secure Dementia Care Unit.`,
    };
  }

  if (input.stateCode === "UT") {
    if (input.secureBeds == null) return null;
    if (input.secureBeds > 0) {
      const beds = input.secureBeds === 1 ? "secure bed" : "secure beds";
      return {
        q,
        a: `Yes. Utah lists ${input.secureBeds} ${beds} at ${input.name}.`,
      };
    }
    return { q, a: NO_SECURED_UNIT_ON_FILE };
  }

  if (input.stateCode === "WA") {
    if (input.waMemoryCareCertified === true) {
      return {
        q,
        a: `Yes. Washington DSHS lists ${input.name} as Memory Care Certified.`,
      };
    }
    if (input.waMemoryCareCertified === false) {
      return { q, a: NO_SECURED_UNIT_ON_FILE };
    }
    const toldUs = waToldUsAcceptsDementia({
      state_code: "WA",
      mc_designation_type: input.mcDesignationType,
      mc_program_quote: input.mcProgramQuote,
      mc_review_notes: input.mcReviewNotes,
    } satisfies MemoryCareBasisInput);
    if (toldUs) return { q, a: NO_SECURED_UNIT_ON_FILE };
  }

  return null;
}
