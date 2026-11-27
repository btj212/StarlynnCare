/**
 * Quality gate for what may be indexed and what may be called memory care.
 *
 * GATE_ENFORCED is false. While it stays false, profile robots, the sitemap,
 * city-hub grouping, JSON-LD, and the evidence line keep today's behavior.
 * The report script is the only thing that scores rows.
 *
 * Headline strings are the approved table. A directory listing, a name, a
 * chain, an operator page, or mc_program_confirmed never produces one.
 * That is narrower than the live Washington display tier, which still treats
 * an operator page as memory care until this flag is turned on.
 */

import { azDirectedCareLicense } from "@/lib/facility/azDirectedCare";
import { hasCaDementiaClientCode, ACCEPTS_DEMENTIA_NO_SECURED_UNIT } from "@/lib/facility/memoryCareBasis";
import { canonicalFor } from "@/lib/seo/canonical";
import { stateFromCode } from "@/lib/states";

/** Curly apostrophe used in the approved sentences. */
const A = "\u2019";

export const GATE_ENFORCED: boolean = false;

/**
 * Arizona has no separate memory-care designation. ADHS treats memory care
 * as directed care, so the Tier A sentence stays in the table and is not
 * returned. `az_memory_care_endorsed` is the same population as Directed
 * Care. Those homes are Tier B.
 */
export const AZ_MC_SOURCE_AVAILABLE: boolean = false;

/** States the gate will cover once GATE_ENFORCED is turned on. */
export const ROLLOUT_STATES = [
  "AZ",
  "CA",
  "CO",
  "IL",
  "MN",
  "MO",
  "OR",
  "PA",
  "TX",
  "UT",
  "WA",
] as const;

export type RolloutState = (typeof ROLLOUT_STATES)[number];

export type CanonicalLicenseStatus = "LICENSED" | "PROBATION" | "CLOSED" | "PENDING" | "OTHER";

/**
 * Every distinct facilities.license_status value on project fwvrupjgwvvzqiutwwdg,
 * counted 2026-11-27, and the canonical bucket it maps to.
 *
 *   LICENSED          → LICENSED     (AZ 2047, CA 5577, CO 856, IL 323, MN 1914,
 *                                      MO 590, OR 2368, PA 1708, TX 1389, UT 748, WA 7425)
 *   CERTIFIED         → LICENSED     (CO 24). CMS-certified nursing homes in good standing.
 *   ON PROBATION      → PROBATION    (CA 18)
 *   PROBATIONARY      → PROBATION    (IL 15)
 *   CLOSED            → CLOSED       (CA 3462, OR 2401, UT 143, WA 1)
 *   PENDING           → PENDING      (CA 18, CO 15, MN 301)
 *   PDR-APPEAL PEND   → PENDING      (PA 6). Provisional decision of revocation, appeal pending.
 *   null              → OTHER        (MN 1)
 */
const LICENSE_STATUS_MAP: Record<string, CanonicalLicenseStatus> = {
  LICENSED: "LICENSED",
  CERTIFIED: "LICENSED",
  "ON PROBATION": "PROBATION",
  PROBATIONARY: "PROBATION",
  CLOSED: "CLOSED",
  PENDING: "PENDING",
  "PDR-APPEAL PEND": "PENDING",
};

export function canonicalLicenseStatus(
  raw: string | null | undefined,
  state: string,
): CanonicalLicenseStatus {
  // The map is national. `state` is part of the signature so a later
  // state-specific variant can branch without a second function.
  void state;
  const key = raw?.trim().toUpperCase() ?? "";
  if (!key) return "OTHER";
  return LICENSE_STATUS_MAP[key] ?? "OTHER";
}

export type HeadlineTier = "A" | "B" | "none";

export type HeadlineLabel = {
  tier: HeadlineTier;
  /** Empty when no approved sentence is justified. */
  label: string;
  explanation: string;
  /** Regulator columns that justified the sentence. */
  columns: string[];
  /** False when the only signals are directory, name, chain, or operator-page. */
  fromRegulator: boolean;
};

type ApprovedRow = {
  tier: "A" | "B";
  label: string;
  explanation: string;
};

export const HEADLINE_TABLE = {
  OR_A: {
    tier: "A",
    label: "Oregon Memory Care Endorsement",
    explanation: "Oregon has approved this home to run a memory care community.",
  },
  MN_A: {
    tier: "A",
    label: "Minnesota Assisted Living with Dementia Care license",
    explanation: "Minnesota licenses this home specifically for dementia care.",
  },
  PA_A: {
    tier: "A",
    label: "Pennsylvania secure dementia care unit",
    explanation: "Pennsylvania records a secured unit for residents with dementia.",
  },
  UT_A: {
    tier: "A",
    label: "Utah secure memory care beds",
    explanation: `Utah${A}s license lists secured beds for residents with dementia.`,
  },
  IL_A: {
    tier: "A",
    label: `Illinois Alzheimer${A}s special care program`,
    explanation: `Illinois has approved this home${A}s dementia care program.`,
  },
  MO_A: {
    tier: "A",
    label: `Missouri Alzheimer${A}s special care unit`,
    explanation: `Missouri records a special care unit for residents with Alzheimer${A}s.`,
  },
  TX_A: {
    tier: "A",
    label: `Texas Alzheimer${A}s certification`,
    explanation: `Texas has certified this home to care for residents with Alzheimer${A}s.`,
  },
  WA_A: {
    tier: "A",
    label: "Washington Memory Care Certified / Specialized Dementia Care contract",
    explanation: "Washington has certified or contracted this home for memory care.",
  },
  CA_A: {
    tier: "A",
    label: "California dementia care disclosure",
    explanation: `This home filed California${A}s required disclosure for dementia care.`,
  },
  AZ_A: {
    tier: "A",
    label: "Arizona memory care services",
    explanation: "Arizona has authorized this home to provide memory care.",
  },
  AZ_B: {
    tier: "B",
    label: "Arizona Directed Care license",
    explanation: `Arizona${A}s license level for residents who can${A}t direct their own care, often including dementia.`,
  },
  WA_B: {
    tier: "B",
    label: "Dementia-trained adult family home",
    explanation: `Washington records dementia training for this small home${A}s staff. It is not a secured unit.`,
  },
  CA_B: {
    tier: "B",
    label: "Licensed to serve residents with dementia",
    explanation: `California${A}s license file lists dementia as a client type. It is not a dementia care disclosure.`,
  },
} as const satisfies Record<string, ApprovedRow>;

export const NONE_EXPLANATION =
  "The state file shows no memory-care designation for this home. Ask the home directly.";

export function noneHeadline(licenseType: string): string {
  return `Licensed ${licenseType}, no memory-care information on file`;
}

/**
 * Tier A columns that are not in the live database, or that are not the
 * regulator file the sentence describes. Those states return `none`.
 */
export const TIER_A_GAPS = [
  {
    state: "CA",
    label: HEADLINE_TABLE.CA_A.label,
    columns: [] as string[],
    gap:
      "No column records a CDSS Health and Safety Code §1569.627 dementia-care disclosure. " +
      "ca_memory_care_designation_basis is not in the live database. " +
      "memory_care_disclosure_filed is a cross-state mirror; on California rows the stored sources are " +
      "§87705/§87706 citations and manual chain review, which are not that disclosure. " +
      "ca_cdss_client_served code 983 is Tier B (a client type), not this sentence.",
  },
] as const;

/**
 * Label → regulator column. Tier B never counts toward a memory-care hub.
 * `or_memory_care_endorsed` is not used; the site reads `mce_endorsed`.
 * `wa_contract_types` is not a headline column (zero WA rows have a dementia
 * contract string without one of the three booleans).
 * Pennsylvania `Special Care` is not the secure-unit sentence.
 */
export const REGULATOR_COLUMN_MAP = [
  { state: "OR", tier: "A", columns: ["mce_endorsed"], label: HEADLINE_TABLE.OR_A.label },
  { state: "MN", tier: "A", columns: ["mn_dementia_care_licensed"], label: HEADLINE_TABLE.MN_A.label },
  { state: "PA", tier: "A", columns: ["mc_designation_type"], label: HEADLINE_TABLE.PA_A.label, value: "Secure Dementia Care Unit" },
  { state: "UT", tier: "A", columns: ["secure_beds"], label: HEADLINE_TABLE.UT_A.label, value: "> 0" },
  { state: "IL", tier: "A", columns: ["il_dementia_program_flag"], label: HEADLINE_TABLE.IL_A.label },
  { state: "MO", tier: "A", columns: ["mo_alzheimer_scu"], label: HEADLINE_TABLE.MO_A.label },
  { state: "TX", tier: "A", columns: ["tx_alzheimer_certified"], label: HEADLINE_TABLE.TX_A.label },
  {
    state: "WA",
    tier: "A",
    columns: ["wa_memory_care_certified", "wa_dementia_care_contract", "wa_earc_sdc_contracted"],
    label: HEADLINE_TABLE.WA_A.label,
  },
  { state: "CA", tier: "A", columns: [], label: HEADLINE_TABLE.CA_A.label, gap: true },
  {
    state: "AZ",
    tier: "A",
    columns: ["az_memory_care_endorsed"],
    label: HEADLINE_TABLE.AZ_A.label,
    disabled: true,
  },
  { state: "AZ", tier: "B", columns: ["az_license_level"], label: HEADLINE_TABLE.AZ_B.label, value: "Directed Care" },
  { state: "WA", tier: "B", columns: ["wa_dementia_specialty"], label: HEADLINE_TABLE.WA_B.label, value: "AFH only" },
  { state: "CA", tier: "B", columns: ["ca_cdss_client_served"], label: HEADLINE_TABLE.CA_B.label, value: "983" },
] as const;

export const PHONE_BADGE = "Confirmed by phone: accepts residents with dementia";
export const DIRECTORY_BADGE = "Reported by directories";
export const PROBATION_BADGE = "On probation";
export const UNENDORSED_BADGE = "Advertises memory care without a state endorsement";

export type SecondaryBadge = {
  label: typeof PHONE_BADGE | typeof DIRECTORY_BADGE | typeof PROBATION_BADGE | typeof UNENDORSED_BADGE;
  tone: "neutral" | "red";
};

export type GateInspection = {
  date?: string | null;
  sourceUrl?: string | null;
  /** Stored citation count. Zero is a real count. Missing stays unknown. */
  citationCount?: number | null;
  /**
   * State visit or event id. Illinois FOIA visit id and Colorado CDPHE event
   * id (for example M5T211) live in inspections.source_event_id.
   */
  visitId?: string | null;
  /**
   * Visit of a previous facility at this address. It does not satisfy
   * this home's inspection requirement.
   */
  predecessor?: boolean;
};

/**
 * An inspection counts when it has a date and an http(s) source URL.
 * Illinois and Colorado have no per-visit document URL. For those two states
 * a date, a citation count (zero allowed), and the state visit or event id
 * are enough. Every other state still needs the URL. A previous operator's
 * visit does not count in any state.
 */
export function inspectionQualifies(state: string, row: GateInspection): boolean {
  if (row.predecessor) return false;
  const date = row.date?.trim() ?? "";
  if (!date) return false;
  const code = state.trim().toUpperCase();
  if (code === "IL" || code === "CO") {
    const count = row.citationCount;
    const visit = row.visitId?.trim() ?? "";
    return typeof count === "number" && Number.isFinite(count) && count >= 0 && visit.length > 0;
  }
  const url = row.sourceUrl?.trim() ?? "";
  return /^https?:\/\//i.test(url);
}

export type GateHome = {
  state_code: string;
  name?: string | null;
  city?: string | null;
  city_slug?: string | null;
  slug?: string | null;
  license_status?: string | null;
  license_type?: string | null;
  license_number?: string | null;
  updated_at?: string | null;
  /** Last successful sync for this state. Null or omitted: condition 7 passes with a TODO. */
  sync_at?: string | null;
  title?: string | null;
  h1?: string | null;
  canonical?: string | null;
  inspections?: GateInspection[] | null;
  /** Built JSON-LD graph. When omitted, the gate builds the minimum graph it checks. */
  jsonLd?: object[] | null;
  mce_endorsed?: boolean | null;
  mn_dementia_care_licensed?: boolean | null;
  mn_lic_type?: string | null;
  mc_designation_type?: string | null;
  secure_beds?: number | null;
  il_dementia_program_flag?: boolean | null;
  il_license_subtype?: string | null;
  mo_alzheimer_scu?: boolean | null;
  mo_level_of_care?: string | null;
  tx_alzheimer_certified?: boolean | null;
  wa_memory_care_certified?: boolean | null;
  wa_dementia_care_contract?: boolean | null;
  wa_earc_sdc_contracted?: boolean | null;
  wa_dementia_specialty?: boolean | null;
  wa_facility_type?: string | null;
  wa_afh_residential_flag?: boolean | null;
  ca_cdss_client_served?: string[] | null;
  az_license_level?: string | null;
  az_memory_care_endorsed?: boolean | null;
  co_care_setting?: string | null;
  mc_signal_apfm_listed?: boolean | null;
  mc_signal_caring_listed?: boolean | null;
  mc_signal_explicit_name?: boolean | null;
  mc_program_confirmed?: boolean | null;
  mc_program_quote?: string | null;
  mc_review_notes?: string | null;
  memory_care_disclosure_filed?: boolean | null;
};

export function gateApplies(stateCode: string | null | undefined): boolean {
  if (!GATE_ENFORCED) return false;
  const code = (stateCode ?? "").trim().toUpperCase();
  return (ROLLOUT_STATES as readonly string[]).includes(code);
}

function approved(row: ApprovedRow, columns: string[]): HeadlineLabel {
  return {
    tier: row.tier,
    label: row.label,
    explanation: row.explanation,
    columns,
    fromRegulator: true,
  };
}

function unlabeled(): HeadlineLabel {
  return { tier: "none", label: "", explanation: "", columns: [], fromRegulator: false };
}

function isAdultFamilyHome(home: GateHome): boolean {
  const type = (home.wa_facility_type ?? "").trim().toUpperCase();
  if (type === "AFH" || type.includes("ADULT FAMILY")) return true;
  if (type === "ALF" || type.includes("ASSISTED LIVING")) return false;
  return home.wa_afh_residential_flag === true;
}

function licenseTypeOf(home: GateHome): { value: string; column: string } | null {
  const direct = home.license_type?.trim();
  if (direct) return { value: direct, column: "license_type" };
  const state = home.state_code.toUpperCase();
  const alternatives: Array<[string, string | null | undefined]> = [];
  if (state === "AZ") alternatives.push(["az_license_level", home.az_license_level]);
  if (state === "MO") alternatives.push(["mo_level_of_care", home.mo_level_of_care]);
  if (state === "MN") alternatives.push(["mn_lic_type", home.mn_lic_type]);
  if (state === "WA") alternatives.push(["wa_facility_type", home.wa_facility_type]);
  if (state === "IL") alternatives.push(["il_license_subtype", home.il_license_subtype]);
  if (state === "CO") alternatives.push(["co_care_setting", home.co_care_setting]);
  for (const [column, raw] of alternatives) {
    const value = raw?.trim();
    if (value) return { value, column };
  }
  return null;
}

export function headlineLabel(home: GateHome): HeadlineLabel {
  const state = home.state_code.toUpperCase();

  if (state === "OR" && home.mce_endorsed === true) {
    return approved(HEADLINE_TABLE.OR_A, ["mce_endorsed"]);
  }
  if (state === "MN" && home.mn_dementia_care_licensed === true) {
    return approved(HEADLINE_TABLE.MN_A, ["mn_dementia_care_licensed"]);
  }
  if (state === "PA" && home.mc_designation_type === "Secure Dementia Care Unit") {
    return approved(HEADLINE_TABLE.PA_A, ["mc_designation_type"]);
  }
  if (state === "UT" && (home.secure_beds ?? 0) > 0) {
    return approved(HEADLINE_TABLE.UT_A, ["secure_beds"]);
  }
  if (state === "IL" && home.il_dementia_program_flag === true) {
    return approved(HEADLINE_TABLE.IL_A, ["il_dementia_program_flag"]);
  }
  if (state === "MO" && home.mo_alzheimer_scu === true) {
    return approved(HEADLINE_TABLE.MO_A, ["mo_alzheimer_scu"]);
  }
  if (state === "TX" && home.tx_alzheimer_certified === true) {
    return approved(HEADLINE_TABLE.TX_A, ["tx_alzheimer_certified"]);
  }
  if (state === "WA") {
    const columns: string[] = [];
    if (home.wa_memory_care_certified === true) columns.push("wa_memory_care_certified");
    if (home.wa_dementia_care_contract === true) columns.push("wa_dementia_care_contract");
    if (home.wa_earc_sdc_contracted === true) columns.push("wa_earc_sdc_contracted");
    if (columns.length > 0) return approved(HEADLINE_TABLE.WA_A, columns);
  }
  // California Tier A is a gap. memory_care_disclosure_filed is not that column.
  if (state === "AZ" && AZ_MC_SOURCE_AVAILABLE && home.az_memory_care_endorsed === true) {
    return approved(HEADLINE_TABLE.AZ_A, ["az_memory_care_endorsed"]);
  }

  if (state === "AZ" && azDirectedCareLicense(home.az_license_level)) {
    return approved(HEADLINE_TABLE.AZ_B, ["az_license_level"]);
  }
  if (state === "WA" && home.wa_dementia_specialty === true && isAdultFamilyHome(home)) {
    return approved(HEADLINE_TABLE.WA_B, ["wa_dementia_specialty"]);
  }
  if (state === "CA" && hasCaDementiaClientCode(home.ca_cdss_client_served)) {
    return approved(HEADLINE_TABLE.CA_B, ["ca_cdss_client_served"]);
  }

  const license = licenseTypeOf(home);
  if (license) {
    return {
      tier: "none",
      label: noneHeadline(license.value),
      explanation: NONE_EXPLANATION,
      columns: [license.column],
      fromRegulator: true,
    };
  }
  return unlabeled();
}

function nameAdvertisesMemoryCare(name: string | null | undefined): boolean {
  return /\bmemory\s*care\b|\balzheimer|\bdementia\b/i.test(name ?? "");
}

export function secondaryBadges(home: GateHome): SecondaryBadge[] {
  const badges: SecondaryBadge[] = [];
  const quote = home.mc_program_quote?.trim() ?? "";
  const notes = home.mc_review_notes?.trim() ?? "";
  if (
    home.mc_designation_type === ACCEPTS_DEMENTIA_NO_SECURED_UNIT &&
    (quote.length > 0 || notes.length > 0)
  ) {
    badges.push({ label: PHONE_BADGE, tone: "neutral" });
  }
  if (home.mc_signal_apfm_listed === true || home.mc_signal_caring_listed === true) {
    badges.push({ label: DIRECTORY_BADGE, tone: "neutral" });
  }
  if (canonicalLicenseStatus(home.license_status, home.state_code) === "PROBATION") {
    badges.push({ label: PROBATION_BADGE, tone: "red" });
  }
  if (
    home.state_code.toUpperCase() === "OR" &&
    home.mce_endorsed !== true &&
    (home.mc_signal_explicit_name === true || nameAdvertisesMemoryCare(home.name))
  ) {
    badges.push({ label: UNENDORSED_BADGE, tone: "red" });
  }
  return badges;
}

export function countsTowardMemoryCareHub(label: HeadlineLabel): boolean {
  return label.tier === "A" && label.fromRegulator;
}

export function memoryCareHubHomes<T extends GateHome>(homes: readonly T[]): T[] {
  return homes.filter((home) => countsTowardMemoryCareHub(headlineLabel(home)));
}

export function memoryCareHubCount(homes: readonly GateHome[]): number {
  return memoryCareHubHomes(homes).length;
}

/** The number printed on a memory-care hub is the length of that same list. */
export function memoryCareHubView<T extends GateHome>(homes: readonly T[]): { homes: T[]; count: number } {
  const list = memoryCareHubHomes(homes);
  return { homes: list, count: list.length };
}

export type GateCondition =
  | "license_status"
  | "inspection"
  | "regulator_label"
  | "explanation"
  | "seo_identity"
  | "jsonld"
  | "freshness";

export type FreshnessResult = "pass" | "fail" | "todo_no_sync";

export const FRESHNESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Sync clock, in this order:
 * 1. max(scrape_runs.completed_at) where status = 'success' for the state.
 *    That table has no public SELECT policy, so the report uses it only when
 *    the service role is configured.
 * 2. states.last_successful_scrape. Populated for CA (2026-07-14), CO
 *    (2026-10-31), and FL. Null for the other live states, and behind
 *    scrape_runs for CA.
 * 3. If both are missing, condition 7 passes and the report records a TODO.
 *    It does not fail the row.
 */
export const FRESHNESS_TODO =
  "No last-successful-sync timestamp for this state. Condition 7 passes until one is recorded.";

export type IndexDecision = {
  indexable: boolean;
  failures: GateCondition[];
  freshness: FreshnessResult;
  headline: HeadlineLabel;
  evaluatedAt: string;
};

function hasQualifyingInspection(home: GateHome): boolean {
  return (home.inspections ?? []).some((row) => inspectionQualifies(home.state_code, row));
}

function typesOf(node: Record<string, unknown>): string[] {
  const value = node["@type"];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

/** LocalBusiness (license identifier) plus a BreadcrumbList with at least one crumb. */
export function jsonLdIsValid(docs: unknown): boolean {
  if (!Array.isArray(docs) || docs.length === 0) return false;
  let business = false;
  let crumbs = false;
  for (const doc of docs) {
    if (!doc || typeof doc !== "object") continue;
    const node = doc as Record<string, unknown>;
    const types = typesOf(node);
    if (types.includes("LocalBusiness")) {
      const identifier = node.identifier;
      if (!identifier || typeof identifier !== "object" || Array.isArray(identifier)) continue;
      const id = identifier as Record<string, unknown>;
      const value = typeof id.value === "string" ? id.value.trim() : "";
      const propertyId = typeof id.propertyID === "string" ? id.propertyID.toLowerCase() : "";
      // The live builder writes "{regulator} license" (for example "ODHS license").
      if (propertyId.includes("license") && value.length > 0) business = true;
    }
    if (types.includes("BreadcrumbList") && Array.isArray(node.itemListElement) && node.itemListElement.length > 0) {
      crumbs = true;
    }
  }
  return business && crumbs;
}

function pageIdentity(home: GateHome): { title: string; h1: string; canonical: string } {
  const state = stateFromCode(home.state_code);
  const name = home.name?.trim() ?? "";
  const city = home.city?.trim() ?? "";
  const slug = home.slug?.trim() ?? "";
  const citySlug = home.city_slug?.trim() ?? "";
  const derivedTitle = name && city ? `${name}, ${city}` : "";
  const derivedH1 = name;
  const derivedCanonical =
    state && citySlug && slug ? canonicalFor(`/${state.slug}/${citySlug}/${slug}`) : "";
  return {
    title: (home.title ?? derivedTitle).trim(),
    h1: (home.h1 ?? derivedH1).trim(),
    canonical: (home.canonical ?? derivedCanonical).trim(),
  };
}

function seoIdentityOk(home: GateHome): boolean {
  const page = pageIdentity(home);
  if (!page.title || !page.h1 || !page.canonical) return false;
  if (!page.canonical.startsWith("http")) return false;
  const slug = home.slug?.trim();
  if (!slug || !page.canonical.includes(`/${slug}`)) return false;
  const name = home.name?.trim();
  if (name && !page.title.includes(name) && !page.h1.includes(name)) return false;
  return true;
}

function minimalJsonLd(home: GateHome): object[] {
  const page = pageIdentity(home);
  const license = home.license_number?.trim() ?? "";
  const name = home.name?.trim() || page.h1 || "Home";
  return [
    {
      "@context": "https://schema.org",
      "@type": ["LocalBusiness", "MedicalOrganization"],
      name,
      url: page.canonical || undefined,
      ...(license
        ? {
            identifier: {
              "@type": "PropertyValue",
              name: "State license number",
              propertyID: "license",
              value: license,
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: canonicalFor("/") },
        { "@type": "ListItem", position: 2, name, ...(page.canonical ? { item: page.canonical } : {}) },
      ],
    },
  ];
}

function freshnessOf(home: GateHome): FreshnessResult {
  const sync = home.sync_at?.trim() ?? "";
  if (!sync) return "todo_no_sync";
  const syncMs = Date.parse(sync);
  const updated = home.updated_at?.trim() ?? "";
  const updatedMs = Date.parse(updated);
  if (!Number.isFinite(syncMs) || !Number.isFinite(updatedMs)) return "fail";
  return updatedMs >= syncMs - FRESHNESS_WINDOW_MS ? "pass" : "fail";
}

function explanationApproved(label: HeadlineLabel): boolean {
  if (!label.fromRegulator || !label.explanation.trim() || !label.label.trim()) return false;
  if (label.tier === "none") {
    return (
      label.explanation === NONE_EXPLANATION &&
      label.label.startsWith("Licensed ") &&
      label.label.endsWith(", no memory-care information on file") &&
      label.label !== noneHeadline("")
    );
  }
  return Object.values(HEADLINE_TABLE).some(
    (row) => row.label === label.label && row.explanation === label.explanation && row.tier === label.tier,
  );
}

export function explainIndexability(home: GateHome, now: Date = new Date()): IndexDecision {
  const headline = headlineLabel(home);
  const status = canonicalLicenseStatus(home.license_status, home.state_code);
  const inspectionOk = hasQualifyingInspection(home);
  const failures: GateCondition[] = [];

  const licenseOk =
    status === "LICENSED" || status === "PROBATION" || (status === "CLOSED" && inspectionOk);
  if (!licenseOk) failures.push("license_status");
  if (!inspectionOk) failures.push("inspection");
  if (!headline.fromRegulator) failures.push("regulator_label");
  if (!explanationApproved(headline)) failures.push("explanation");
  if (!seoIdentityOk(home)) failures.push("seo_identity");
  const graph = home.jsonLd ?? minimalJsonLd(home);
  if (!jsonLdIsValid(graph)) failures.push("jsonld");
  const freshness = freshnessOf(home);
  if (freshness === "fail") failures.push("freshness");

  return {
    indexable: failures.length === 0,
    failures,
    freshness,
    headline,
    evaluatedAt: now.toISOString(),
  };
}

export function isIndexable(home: GateHome, now: Date = new Date()): boolean {
  return explainIndexability(home, now).indexable;
}

export const AZ_SMALL_BED_LIMIT = 10;

/** Still true for an Arizona home of 10 beds or fewer with no citations. Hubs list that home anyway. */
export function azSmallHomeWithoutCitations(
  stateCode: string,
  beds: number | null,
  deficiencyCount: number,
): boolean {
  return stateCode === "AZ" && beds != null && beds <= AZ_SMALL_BED_LIMIT && deficiencyCount === 0;
}

/**
 * Publishable profiles stay indexable today, including a Washington adult
 * family home with no inspection and a small Arizona home with no citations.
 * While the gate is off this returns false. Profile pages call
 * profileRobotsNoindex, which uses isIndexable only after the flag is on.
 */
export function facilityMarkedNoindex(_input: {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
  reviewCount: number;
  tourQuestionCount: number;
  photoCount: number;
}): boolean {
  // Profile pages call profileRobotsNoindex. That uses isIndexable only
  // after GATE_ENFORCED is on. This predicate stays false either way, so a
  // publishable profile is not marked noindex by bed count or citation count.
  void _input;
  return false;
}

/**
 * City hub listed set. Every publishable home is listed, including a home
 * of 6 beds or fewer and an Arizona home of 10 beds or fewer with no
 * citations. Turning the gate on does not take a live home off this list.
 * The arguments stay so callers can pass the same record they always did.
 */
export function facilityListedOnHub(input: {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
}): boolean {
  // Bed count and citations do not decide the list. GATE_ENFORCED does not
  // remove a live home from its city hub.
  void input;
  return true;
}

/**
 * A city hub page exists when it has at least one listed home. State-hub
 * links, the homepage city count, and the hub sitemap use the same bar.
 */
export const CITY_HUB_MIN_HOMES = 1;

export function cityHubPageExists(listedHomeCount: number): boolean {
  return listedHomeCount >= CITY_HUB_MIN_HOMES;
}

/** @deprecated Use facilityListedOnHub for city counts; sitemap includes every publishable profile. */
export function facilityListedInSitemap(input: {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
}): boolean {
  return facilityListedOnHub(input);
}

/**
 * A hub is noindex only when it has homes and none of them are listed.
 * Empty hubs 404 instead. With every publishable home listed, this is false.
 */
export function listingHubMarkedNoindex(
  facilities: Array<{
    stateCode: string;
    beds: number | null;
    deficiencyCount: number;
    inspectionCount?: number;
  }>,
): boolean {
  return (
    facilities.length > 0 &&
    facilities.every(
      (facility) =>
        !facilityListedOnHub({
          stateCode: facility.stateCode,
          beds: facility.beds,
          deficiencyCount: facility.deficiencyCount,
          inspectionCount: facility.inspectionCount ?? 0,
        }),
    )
  );
}

type LegacyNoindexInput = {
  stateCode: string;
  beds: number | null;
  deficiencyCount: number;
  inspectionCount: number;
  reviewCount: number;
  tourQuestionCount: number;
  photoCount: number;
};

/**
 * Profile and inspection-report robots. While the gate is off, this is
 * facilityMarkedNoindex and nothing else.
 */
export function profileRobotsNoindex(input: {
  legacy: LegacyNoindexInput;
  home?: GateHome;
  now?: Date;
}): boolean {
  if (!gateApplies(input.legacy.stateCode) || !input.home) {
    return facilityMarkedNoindex(input.legacy);
  }
  return !isIndexable(input.home, input.now ?? new Date());
}

/**
 * Evidence line under the profile H1. While the gate is off, the caller
 * passes the line the page already shows (the regulator name).
 */
export function evidenceLabelText(home: GateHome, currentLine: string): string {
  if (!gateApplies(home.state_code)) return currentLine;
  const headline = headlineLabel(home);
  return headline.label.trim() ? headline.label : currentLine;
}

/** JSON-LD array. While the gate is off, the graph is returned unchanged. */
export function finalizeJsonLd<T>(docs: T[]): T[] {
  if (!GATE_ENFORCED) return docs;
  void jsonLdIsValid(docs);
  return docs;
}

/**
 * Sitemap rows. While the gate is off, the same array is returned and the
 * predicate is not called.
 */
export function rowsForSitemap<T>(
  rows: T[],
  stateCode: string,
  indexable: (row: T) => boolean,
): T[] {
  if (!gateApplies(stateCode)) return rows;
  return rows.filter(indexable);
}
