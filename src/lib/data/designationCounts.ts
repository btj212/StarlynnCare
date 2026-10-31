import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Counts of homes the state file lists under a memory-care designation.
 * Name matches are not a designation, so they are not counted.
 * A query that errors returns null so the page does not print a zero.
 */

export type DesignationState = "OR" | "PA" | "MO" | "TX";

export type DesignationSnapshot = {
  published: number | null;
  endorsed: number | null;
  secureDementiaCareUnit: number | null;
  specialCare: number | null;
  alzheimerScuDisclosure: number | null;
  alfStar: number | null;
  alzheimerCertified: number | null;
};

const MO_SCU_SOURCE = "DHSS Alzheimer's SCU Disclosure §198.510";
const MO_ALF_SOURCE = "DHSS ALF** license (§198.073.6 RSMo)";

const EMPTY: DesignationSnapshot = {
  published: null,
  endorsed: null,
  secureDementiaCareUnit: null,
  specialCare: null,
  alzheimerScuDisclosure: null,
  alfStar: null,
  alzheimerCertified: null,
};

async function countRows(
  supabase: SupabaseClient,
  state: DesignationState,
  column?: "mce_endorsed" | "mc_designation_type" | "memory_care_disclosure_source" | "tx_alzheimer_certified",
  value?: string | boolean,
): Promise<number | null> {
  let query = supabase
    .from("facilities")
    .select("id", { count: "exact", head: true })
    .eq("publishable", true)
    .eq("state_code", state);
  if (column === "mce_endorsed" || column === "tx_alzheimer_certified") {
    query = query.eq(column, value === true);
  } else if (column === "mc_designation_type" || column === "memory_care_disclosure_source") {
    query = query.eq(column, String(value));
  }
  const { count, error } = await query;
  if (error || count == null) {
    console.error(`[designationCounts] count failed for ${state}`);
    return null;
  }
  return count;
}

export async function loadDesignationCounts(
  supabase: SupabaseClient,
  state: DesignationState,
): Promise<DesignationSnapshot> {
  const published = await countRows(supabase, state);
  if (state === "OR") {
    return { ...EMPTY, published, endorsed: await countRows(supabase, state, "mce_endorsed", true) };
  }
  if (state === "PA") {
    return {
      ...EMPTY,
      published,
      secureDementiaCareUnit: await countRows(supabase, state, "mc_designation_type", "Secure Dementia Care Unit"),
      specialCare: await countRows(supabase, state, "mc_designation_type", "Special Care"),
    };
  }
  if (state === "MO") {
    return {
      ...EMPTY,
      published,
      alzheimerScuDisclosure: await countRows(supabase, state, "memory_care_disclosure_source", MO_SCU_SOURCE),
      alfStar: await countRows(supabase, state, "memory_care_disclosure_source", MO_ALF_SOURCE),
    };
  }
  return {
    ...EMPTY,
    published,
    alzheimerCertified: await countRows(supabase, state, "tx_alzheimer_certified", true),
  };
}
