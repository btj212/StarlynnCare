import type { CareCategory } from "@/lib/types";

const CATEGORY_SHORT: Partial<Record<CareCategory, string>> = {
  rcfe_memory_care: "RCFE",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF",
  alf_general: "ALF",
  snf_general: "Nursing home",
  snf_dementia_scu: "Nursing home",
  ccrc: "CCRC",
};

function compactLicense(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const upper = t.toUpperCase();
  if (upper === "RCF" || upper.includes("RESIDENTIAL CARE")) return "RCF";
  if (upper === "ALF" || upper === "ALF**" || upper.startsWith("ALF")) {
    return upper.includes("**") ? "ALF**" : "ALF";
  }
  if (upper === "NF" || upper === "SNF" || upper.includes("NURSING")) return "NF";
  if (upper === "ALDC" || upper.includes("DEMENTIA CARE")) return "ALDC";
  if (upper === "AL" || upper === "ASSISTED LIVING") return "AL";
  if (upper.includes("RCFE") && upper.includes("CCRC")) return "RCFE-CCRC";
  if (upper.includes("RCFE")) return "RCFE";
  if (upper.includes("PERSONAL CARE")) return "Personal care";
  return t;
}

/**
 * Card / list license chip. Prefer the state's own license field over the
 * California-shaped care_category (which labeled Oregon RCFs as ALF and
 * every Missouri home as "Care facility").
 */
export function listLicenseLabel(input: {
  stateCode: string;
  care_category: CareCategory;
  license_type?: string | null;
  mo_level_of_care?: string | null;
  mn_dementia_care_licensed?: boolean | null;
}): string {
  const code = input.stateCode.toUpperCase();

  if (code === "MO") {
    const level = compactLicense(input.mo_level_of_care ?? "");
    if (level) return level;
    const lt = compactLicense(input.license_type ?? "");
    return lt || "ALF/RCF";
  }

  if (code === "MN") {
    if (input.mn_dementia_care_licensed === false) {
      return "Assisted living (no dementia care license)";
    }
    const lt = compactLicense(input.license_type ?? "");
    if (lt) return lt;
    return input.mn_dementia_care_licensed ? "ALDC" : "Assisted living";
  }

  if (code === "OR") {
    const lt = compactLicense(input.license_type ?? "");
    if (lt) return lt;
  }

  if (code === "CO" && input.care_category.startsWith("alf")) {
    return "Assisted living";
  }

  const lt = compactLicense(input.license_type ?? "");
  if (lt) return lt;
  return CATEGORY_SHORT[input.care_category] ?? "Care facility";
}

export type HubSizeGroup = "large" | "medium" | "small" | "unspecified";

/**
 * Bed groups for the city card grid. A null bed count is not "7–49".
 * Chicago's assisted living rows have no bed count in the IDPH file.
 */
export function hubSizeGroup(input: {
  beds: number | null;
  capacity_tier?: string | null;
}): HubSizeGroup {
  if (input.beds == null) return "unspecified";
  if (input.beds <= 6) return "small";
  if (input.beds >= 50) return "large";
  return "medium";
}

export function listSectionDeck(stateSlug: string, size: "large" | "medium" | "unspecified"): string {
  if (size === "unspecified") {
    return "Bed count is not in the state file for these homes.";
  }
  const slug = stateSlug.toLowerCase();
  if (size === "large") {
    if (slug === "washington") return "Larger assisted living communities in this city.";
    if (slug === "oregon") return "Larger Oregon homes with a Memory Care Endorsement.";
    if (slug === "minnesota") return "Larger assisted living communities, including ALDC licenses.";
    if (slug === "missouri") return "Larger DHSS-licensed assisted living and residential care homes.";
    return "Community-style facilities (purpose-built buildings, common in regional chains).";
  }
  if (slug === "colorado") return "Smaller assisted living residences with a memory-care program.";
  if (slug === "arizona") return "Small to medium Directed Care homes authorized for memory care services.";
  if (slug === "washington") return "Small to medium assisted living and adult family homes.";
  if (slug === "oregon") {
    return "Small to medium residential care and assisted living homes with a Memory Care Endorsement.";
  }
  if (slug === "minnesota") {
    return "Small to medium Minnesota assisted living homes. ALDC is the dementia-care license; AL is not.";
  }
  if (slug === "missouri") {
    return "Small to medium DHSS-licensed assisted living (ALF) and residential care (RCF) homes.";
  }
  if (slug === "california") {
    return "Small to medium freestanding RCFEs with a memory-care program.";
  }
  return "Small to medium licensed homes listed for this city.";
}

export function listSectionTitle(
  stateSlug: string,
  size: "large" | "medium" | "unspecified",
): string {
  if (size === "unspecified") return "Homes, size not on file";
  const slug = stateSlug.toLowerCase();
  const beds = size === "large" ? "50+ beds" : "7–49 beds";
  if (slug === "washington") return `Listed homes · ${beds}`;
  if (slug === "oregon") return `Memory care endorsed · ${beds}`;
  if (slug === "minnesota") return `Assisted living · ${beds}`;
  if (slug === "missouri") return `Assisted living and residential care · ${beds}`;
  if (slug === "arizona") return `Directed Care · ${beds}`;
  return `Memory care · ${beds}`;
}
