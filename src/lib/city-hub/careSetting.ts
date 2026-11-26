/**
 * State-accurate care-setting copy.
 *
 * Arizona indexes Directed Care homes. A.A.C. R9-10-816 attaches memory-care
 * service requirements to every assisted living facility authorized for
 * directed care (HB2764 / Laws 2024, Ch. 100 did not create a separate
 * Memory Care subclass). Washington indexes assisted living and adult family
 * homes; a Specialized Dementia Care contract or AFH dementia specialty is
 * the memory-care label, not the listing bar.
 */

import type { MemoryCareBasis } from "@/lib/facility/memoryCareBasis";

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

export function listCareChip(input: {
  stateCode: string;
  basis: MemoryCareBasis;
}): string | null {
  const code = input.stateCode.toUpperCase();
  if (input.basis.kind === "memory-care") {
    if (code === "WA") {
      return /specialty/i.test(input.basis.label)
        ? "Dementia specialty"
        : "Dementia care contract";
    }
    if (code === "PA") return "Special care";
    if (code === "AZ") return "Directed Care";
    return "Memory care";
  }
  if (code === "AZ" && input.basis.kind === "care-level") return "Directed Care";
  return null;
}
