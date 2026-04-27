import type { CareCategory } from "@/lib/types";

/** Homepage rotating sample card (§02) — matches `facility_snapshot` + facilities row */
export type HomeSampleFacility = {
  id: string;
  name: string;
  city: string | null;
  state_code: string;
  slug: string;
  city_slug: string;
  license_number?: string | null;
  beds?: number | null;
  care_category: CareCategory;
  grade: string | null;
  composite: number | null;
  sev_pct: number | null;
  rep_pct: number | null;
  freq_pct: number | null;
};
