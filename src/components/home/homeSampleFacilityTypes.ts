/** Homepage / state-hub rotating sample card (§02) — facilities row + `facility_snapshot` peer percentiles */
export type HomeSampleFacility = {
  id: string;
  name: string;
  city: string | null;
  state_code: string;
  slug: string;
  city_slug: string;
  license_number?: string | null;
  beds?: number | null;
  sev_pct: number | null;
  rep_pct: number | null;
  freq_pct: number | null;
};
