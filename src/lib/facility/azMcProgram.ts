/**
 * Arizona two-level memory-care badge.
 *
 * Level 1 is the Directed Care license (A.A.C. R9-10-816) and is shown for
 * every AZ Directed Care home. Level 2 is an operator-sourced confirmation
 * that this exact address has a named or secured memory-care program.
 * Level 2 never changes publishable / listed / sitemap state.
 */

export const AZ_MC_LEVEL1_LABEL =
  "State-authorized for memory care: licensed for Directed Care (A.A.C. R9-10-816)";

export const AZ_MC_LEVEL2_LABEL = "Memory care program confirmed";

export type AzMcProgram = {
  confirmed: boolean;
  sourceUrl: string | null;
  quote: string | null;
  checkedOn: string | null;
};

export function azMcProgram(facility: {
  mc_program_confirmed?: boolean | null;
  mc_program_source_url?: string | null;
  mc_program_quote?: string | null;
  mc_program_checked_at?: string | null;
}): AzMcProgram {
  const confirmed = facility.mc_program_confirmed === true;
  if (!confirmed) {
    return { confirmed: false, sourceUrl: null, quote: null, checkedOn: null };
  }
  const url = facility.mc_program_source_url?.trim() || null;
  const quote = facility.mc_program_quote?.trim() || null;
  const checkedOn = facility.mc_program_checked_at?.slice(0, 10) || null;
  return { confirmed: true, sourceUrl: url, quote, checkedOn };
}
