/**
 * State-accurate care-setting copy.
 *
 * Arizona indexes Directed Care homes. A.A.C. R9-10-816 attaches memory-care
 * service requirements to every assisted living facility authorized for
 * directed care (HB2764 / Laws 2024, Ch. 100 did not create a separate
 * Memory Care subclass). Washington indexes assisted living and adult family
 * homes. A home is memory care only with Memory Care Certified status, a
 * Specialized Dementia Care contract, or the operator's own page for that
 * address. An adult family home can qualify only from that operator page.
 * The DSHS dementia specialty is staff training. On an adult family home it
 * is a staff-training credential, not memory care and not a confirmation
 * that the home accepts residents with dementia. A separate label,
 * "Confirmed: accepts residents with dementia", is only for a home that
 * told StarlynnCare it accepts residents and has no secured unit.
 */

import {
  CONFIRMED_ACCEPTS_CHIP,
  DEMENTIA_CREDENTIAL_CHIP,
  type DementiaAcceptanceTier,
  type MemoryCareBasis,
} from "@/lib/facility/memoryCareBasis";

export type CareSettingCopy = {
  /** Short noun for titles and stats: "Directed Care homes" */
  hubNoun: string;
  /** Singular, for a facility sentence. */
  facilityNoun: string;
  /** H1 topic: "Directed Care homes in Mesa, AZ" */
  h1Topic: string;
  /** JSON-LD / breadcrumb collection name. */
  collectionName: (cityName: string) => string;
  /** One-line license explainer for the answer box. */
  licenseExplainer: string;
  /** Peer-set phrase for rank copy: "Arizona Directed Care", "California memory care". */
  peerSet: string;
};

export function careSettingCopy(stateCode: string): CareSettingCopy {
  const code = stateCode.toUpperCase();

  if (code === "AZ") {
    return {
      hubNoun: "Directed Care homes",
      facilityNoun: "Directed Care licensed home",
      h1Topic: "Directed Care homes",
      collectionName: (city) => `Directed Care homes in ${city}`,
      licenseExplainer:
        "Licensed for Directed Care. Arizona authorizes these homes to provide memory care services (A.A.C. R9-10-816). That is the license level, not a claim that a given home runs a dedicated secured memory-care unit.",
      peerSet: "Arizona Directed Care",
    };
  }

  if (code === "WA") {
    return {
      hubNoun: "homes that serve people with dementia",
      facilityNoun: "licensed home that may serve residents with dementia",
      h1Topic: "Homes that serve people with dementia",
      collectionName: (city) => `Dementia care homes in ${city}`,
      licenseExplainer:
        "Washington DSHS inspects assisted living facilities and adult family homes. A Specialized Dementia Care contract is a separate Medicaid dementia-care signal, not the default license.",
      peerSet: "Washington assisted living",
    };
  }

  if (code === "PA") {
    return {
      hubNoun: "personal care and assisted living homes",
      facilityNoun: "licensed personal care or assisted living home",
      h1Topic: "Personal care and assisted living",
      collectionName: (city) => `Personal care and assisted living in ${city}`,
      licenseExplainer:
        "In Pennsylvania most dementia care is provided in Personal Care Homes (55 Pa Code Ch 2600) or Assisted Living Residences (Ch 2800), inspected by DHS OLTL.",
      peerSet: "Pennsylvania personal care and assisted living",
    };
  }

  if (code === "TX") {
    return {
      hubNoun: "Alzheimer-certified assisted living facilities",
      facilityNoun: "Alzheimer-certified assisted living facility",
      h1Topic: "Alzheimer-certified assisted living",
      collectionName: (city) => `Alzheimer-certified assisted living in ${city}`,
      licenseExplainer:
        "Texas homes here hold HHSC Alzheimer certification on a Type A or Type B assisted living license.",
      peerSet: "Texas Alzheimer-certified assisted living",
    };
  }

  if (code === "CO") {
    return {
      hubNoun: "memory care facilities",
      facilityNoun: "memory care facility",
      h1Topic: "Memory care",
      collectionName: (city) => `Memory care in ${city}`,
      licenseExplainer:
        "Colorado does not issue a separate memory-care license. Assisted living citations are CDPHE Level A–E; nursing homes use CMS F-tags.",
      peerSet: "Colorado memory care",
    };
  }

  if (code === "OR") {
    return {
      hubNoun: "memory care endorsed homes",
      facilityNoun: "Oregon memory care endorsed home",
      h1Topic: "Memory care",
      collectionName: (city) => `Memory care in ${city}`,
      licenseExplainer:
        "Oregon homes here hold a DHS Memory Care Endorsement under ORS 443.886. Most are licensed as residential care facilities (RCF); some are assisted living (ALF) or nursing facilities (NF).",
      peerSet: "Oregon memory care",
    };
  }

  if (code === "MN") {
    return {
      hubNoun: "assisted living homes",
      facilityNoun: "Minnesota assisted living home",
      h1Topic: "Memory care",
      collectionName: (city) => `Memory care in ${city}`,
      licenseExplainer:
        "Minnesota memory care requires an Assisted Living with Dementia Care (ALDC) license under Minn. Stat. ch. 144G. Homes licensed only as assisted living (AL) are listed and labeled separately.",
      peerSet: "Minnesota assisted living",
    };
  }

  if (code === "MO") {
    return {
      hubNoun: "DHSS-licensed assisted living and residential care homes",
      facilityNoun: "Missouri ALF or RCF",
      h1Topic: "Memory care",
      collectionName: (city) => `Memory care in ${city}`,
      licenseExplainer:
        "Missouri homes here are licensed as assisted living or residential care facilities by DHSS under 19 CSR 30. There is no separate memory-care license.",
      peerSet: "Missouri assisted living",
    };
  }

  if (code === "CA") {
    return {
      hubNoun: "licensed memory care facilities",
      facilityNoun: "CDSS-licensed RCFE",
      h1Topic: "Memory care",
      collectionName: (city) => `Memory care in ${city}`,
      licenseExplainer:
        "Memory care in California is provided by licensed Residential Care Facilities for the Elderly (RCFEs), inspected by CDSS Community Care Licensing.",
      peerSet: "California memory care",
    };
  }

  return {
    hubNoun: "licensed memory care facilities",
    facilityNoun: "licensed memory care home",
    h1Topic: "Memory care",
    collectionName: (city) => `Memory care in ${city}`,
    licenseExplainer: "Homes here are listed from the state license file for dementia care.",
    peerSet: "memory care",
  };
}

/** Rank / SERP phrase: "Arizona Directed Care", "California memory care". */
export function peerSetPhrase(stateCode: string, stateName: string): string {
  const setting = careSettingCopy(stateCode);
  return setting.peerSet === "memory care" ? `${stateName} memory care` : setting.peerSet;
}

/** True when a list/profile may print a "Memory care" chip. */
export function showsMemoryCareLabel(basis: MemoryCareBasis): boolean {
  return basis.kind === "memory-care";
}

/**
 * Washington city-hub cards group as memory care only when the chip names a
 * real designation. `serves_memory_care` stays true for published adult
 * family homes whose review cited only the dementia-specialty training flag.
 * Pages that have not computed a chip leave `careChip` undefined and keep
 * the older serves_memory_care grouping.
 */
export function listedInMemoryCareGroup(input: {
  stateSlug: string;
  careChip?: string | null;
  servesMemoryCare: boolean;
  memoryCareDisclosureFiled: boolean;
  txAlzheimerCertified?: boolean | null;
}): boolean {
  if (input.stateSlug === "washington" && input.careChip !== undefined) {
    if (
      input.careChip === CONFIRMED_ACCEPTS_CHIP ||
      input.careChip === DEMENTIA_CREDENTIAL_CHIP
    ) {
      return false;
    }
    return Boolean(input.careChip);
  }
  return (
    input.memoryCareDisclosureFiled ||
    input.servesMemoryCare ||
    Boolean(input.txAlzheimerCertified)
  );
}

export function listCareChip(input: {
  stateCode: string;
  basis: MemoryCareBasis;
  tier?: DementiaAcceptanceTier;
}): string | null {
  if (input.tier === "confirmed-accepts") return CONFIRMED_ACCEPTS_CHIP;
  if (input.tier === "credential") return DEMENTIA_CREDENTIAL_CHIP;
  const code = input.stateCode.toUpperCase();
  if (input.basis.kind === "memory-care") {
    if (code === "WA") {
      const label = input.basis.label;
      if (/memory-care certified/i.test(label)) return "Memory Care Certified";
      if (/operator's own page/i.test(label)) return "Memory care program (operator)";
      if (/dementia care contract/i.test(label)) return "Specialized Dementia Care contract";
      return null;
    }
    if (code === "PA") return "Special care";
    if (code === "AZ") return "Directed Care";
    return "Memory care";
  }
  if (code === "AZ" && input.basis.kind === "care-level") return "Directed Care";
  if (code === "WA" && /no secured or dedicated memory-care unit/i.test(input.basis.label)) {
    return CONFIRMED_ACCEPTS_CHIP;
  }
  if (code === "WA" && /not a secured memory-care unit/i.test(input.basis.label)) {
    return DEMENTIA_CREDENTIAL_CHIP;
  }
  return null;
}

export type CityHubCardGroup =
  | "memory-care"
  | "confirmed-accepts"
  | "credential"
  | "other"
  | "small";

/** Which first-grid section a card belongs in. Tier 2 is its own section even when the home has 6 or fewer beds. */
export function cityHubCardGroup(input: {
  careChip?: string | null;
  capacityTier: "small" | "medium" | "large" | "unknown";
  inMemoryCareGroup: boolean;
}): CityHubCardGroup {
  if (input.careChip === CONFIRMED_ACCEPTS_CHIP) return "confirmed-accepts";
  if (input.careChip === DEMENTIA_CREDENTIAL_CHIP) return "credential";
  if (input.capacityTier === "small") return "small";
  if (input.inMemoryCareGroup) return "memory-care";
  return "other";
}
