/**
 * Hand-written types mirroring StarlynnCare schema (supabase/migrations/0001_init.sql).
 * Regenerate from Supabase later if desired.
 */

export type StateConfidence = "high" | "medium" | "low";

export interface State {
  id: number;
  code: string;
  name: string;
  scraper_name: string | null;
  last_successful_scrape: string | null;
  confidence: StateConfidence | null;
  sla_days: number | null;
  notes: string | null;
}

export type OwnershipType = "for-profit" | "non-profit" | "government";

/**
 * The CA regulatory or signal basis for a memory-care classification.
 * Mirrors the CHECK constraint on facilities.ca_memory_care_designation_basis.
 */
export type CaMemoryCareDesignationBasis =
  | "self_identified"
  | "dementia_training_compliance"
  | "secured_perimeter"
  | "hospice_waiver"
  | "multiple";

export type CareCategory =
  | "rcfe_memory_care"
  | "rcfe_general"
  | "alf_memory_care"
  | "alf_general"
  | "snf_general"
  | "snf_dementia_scu"
  | "ccrc"
  | "unknown";

export interface Facility {
  id: string;
  state_code: string;
  name: string;
  cms_id: string | null;
  license_number: string | null;
  license_type: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  city_slug: string;
  slug: string;
  beds: number | null;
  facility_type: string | null;
  certification_type: string | null;
  operator_name: string | null;
  management_company: string | null;
  ownership_type: OwnershipType | null;
  phone: string | null;
  website: string | null;
  cms_star_rating: number | null;
  last_inspection_date: string | null;
  latitude: string | null;
  longitude: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;

  // Added in migration 0002_alameda_beachhead.sql
  care_category: CareCategory;
  serves_memory_care: boolean;
  memory_care_designation: string | null;
  license_status: string | null;
  license_expiration: string | null;
  publishable: boolean;

  /**
   * CA-specific: the regulatory or signal basis for the memory-care classification.
   * NULL means the signal exists but the basis is not yet resolved.
   * Added in migration 0013_mc_designation_basis.sql
   */
  ca_memory_care_designation_basis: CaMemoryCareDesignationBasis | null;

  /** TX HHSC scaffold — migration 0014_tx_scaffold_columns.sql */
  tx_license_class?: string | null;
  tx_alzheimer_certified?: boolean | null;

  // Added in migration 0008_capacity_tier_and_mc_disclosure.sql
  /**
   * Derived from beds: 'small' (≤6), 'medium' (7–49), 'large' (50+), 'unknown'.
   * Generated column — never write directly.
   */
  capacity_tier: "small" | "medium" | "large" | "unknown";
  /**
   * True if the facility has filed a §1569.627 dementia-care disclosure with CDSS,
   * or been confirmed via §87705/§87706 citation scan.
   * UI: mcSignal = memory_care_disclosure_filed || serves_memory_care.
   */
  memory_care_disclosure_filed: boolean;
  /** Provenance string for memory_care_disclosure_filed. */
  memory_care_disclosure_source: string | null;

  // Added in migration 0004_facility_photos.sql
  photo_url: string | null;
  photo_attribution: string | null;

  // Added in migration 0003_facility_content.sql
  content: {
    headline?: string;
    intro?: string;
    memory_care_approach?: string;
    neighborhood?: string;
    what_families_should_know?: string;
    generated_at?: string;
    model?: string;
  } | null;
}

export type InspectionType =
  | "standard"
  | "complaint"
  | "follow-up"
  | "focused"
  | string;

export interface Inspection {
  id: string;
  facility_id: string;
  inspection_date: string;
  inspection_type: string | null;
  is_complaint: boolean;
  complaint_id: string | null;
  total_deficiency_count: number | null;
  civil_money_penalty_total: string | null;
  special_focus: boolean;
  source_url: string;
  source_agency: string;
  scrape_run_id: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export type DeficiencyScope = "isolated" | "pattern" | "widespread";

export interface Deficiency {
  id: string;
  inspection_id: string;
  ftag: string | null;
  code: string | null;
  category: string | null;
  scope: DeficiencyScope | null;
  severity: number | null;
  scope_severity_code: string | null;
  class: string | null;
  immediate_jeopardy: boolean;
  substandard_quality_of_care: boolean;
  is_repeat: boolean;
  description: string | null;
  inspector_narrative: string | null;
  harm_description: string | null;
  residents_affected: number | null;
  plan_of_correction: string | null;
  poc_deadline: string | null;
  cited_date: string | null;
  corrected_date: string | null;
  status: string | null;
  civil_money_penalty: string | null;
  /** Verbatim regulator severity label when differing from normalized `severity` int — migration 0014 */
  state_severity_raw?: string | null;
  created_at: string;
}

export type ScrapeRunStatus = "running" | "success" | "partial" | "failed";

export interface ScrapeRun {
  id: string;
  state_code: string;
  scraper_name: string;
  started_at: string;
  completed_at: string | null;
  status: ScrapeRunStatus;
  records_found: number | null;
  records_new: number | null;
  records_updated: number | null;
  error_log: string | null;
  evaluator_result: Record<string, unknown> | null;
  repair_attempted: boolean;
  repair_result: Record<string, unknown> | null;
}

export type ContentRunStatus =
  | "running"
  | "passed"
  | "failed_quality_gate"
  | "error";

export interface ContentRun {
  id: string;
  facility_id: string;
  started_at: string;
  completed_at: string | null;
  status: ContentRunStatus;
  quality_gate_result: Record<string, unknown> | null;
  generated_content: Record<string, unknown> | null;
  published: boolean;
}

/** Fields commonly selected for list cards */
export type FacilityListRow = Pick<
  Facility,
  | "id"
  | "name"
  | "city"
  | "city_slug"
  | "slug"
  | "cms_star_rating"
  | "beds"
  | "last_inspection_date"
  | "care_category"
  | "serves_memory_care"
  | "memory_care_designation"
  | "publishable"
  | "capacity_tier"
  | "memory_care_disclosure_filed"
>;
