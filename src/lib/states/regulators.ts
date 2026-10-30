/**
 * State license offices we cite. Short names match the facility profile
 * configs. Portal URLs match those configs, or the license lookup already
 * used in schema.ts where a config has no portal.
 */

export type StateRegulator = {
  short: string;
  long: string;
  portalUrl: string;
  /** Name used in llms.txt, specific enough that two "DHS" states stay distinct. */
  cite: string;
};

export const STATE_REGULATORS: Record<string, StateRegulator> = {
  AZ: {
    short: "ADHS",
    long: "Arizona Dept. of Health Services · Bureau of Residential Facilities Licensing",
    portalUrl: "https://azcarecheck.azdhs.gov",
    cite: "ADHS (Arizona)",
  },
  CA: {
    short: "CDSS",
    long: "California Dept. of Social Services · Community Care Licensing",
    portalUrl: "https://www.ccld.dss.ca.gov/carefacilitysearch/",
    cite: "CDSS (California)",
  },
  IL: {
    short: "IDPH",
    long: "Illinois Department of Public Health, Division of Assisted Living",
    portalUrl: "https://llcs.dph.illinois.gov/s/?language=en_US",
    cite: "IDPH (Illinois)",
  },
  MN: {
    short: "MDH",
    long: "Minnesota Dept. of Health · Health Regulation Division",
    portalUrl: "https://www.health.state.mn.us/facilities/providers/index.html",
    cite: "MDH (Minnesota)",
  },
  MO: {
    short: "DHSS",
    long: "Missouri Dept. of Health and Senior Services · Section for Long-Term Care Regulation",
    portalUrl: "https://healthapps.dhss.mo.gov/showmeltc/",
    cite: "DHSS (Missouri)",
  },
  OR: {
    short: "OR DHS",
    long: "Oregon Dept. of Human Services · Long-Term Care Licensing",
    portalUrl: "https://ltclicensing.oregon.gov",
    cite: "Oregon DHS",
  },
  PA: {
    short: "PA DHS",
    long: "Pennsylvania Department of Human Services, Office of Long-Term Living",
    portalUrl: "https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/",
    cite: "Pennsylvania DHS",
  },
  TX: {
    short: "HHSC",
    long: "Texas Health & Human Services Commission · Long-Term Care Regulation",
    portalUrl: "https://apps.hhs.texas.gov/LTCSearch/",
    cite: "HHSC (Texas)",
  },
  UT: {
    short: "DLBC",
    long: "Utah Dept. of Health & Human Services · Division of Licensing and Background Checks",
    portalUrl: "https://ccl.utah.gov",
    cite: "DLBC (Utah)",
  },
  WA: {
    short: "DSHS",
    long: "Washington DSHS · Aging and Disability Services Administration",
    portalUrl: "https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx",
    cite: "DSHS (Washington)",
  },
};

export function regulatorFor(stateCode: string): StateRegulator | null {
  return STATE_REGULATORS[stateCode.toUpperCase()] ?? null;
}

export function joinAnd(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
