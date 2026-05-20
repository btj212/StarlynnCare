import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { stateFromSlug, COVERED_STATES } from "@/lib/states";
import { canonicalFor } from "@/lib/seo/canonical";
import { regulatorLicensePageFor } from "@/lib/seo/schema";

export const revalidate = 3600;

type FacilityRow = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  street: string | null;
  city: string | null;
  zip: string | null;
  state_code: string;
  latitude: number | null;
  longitude: number | null;
  license_number: string | null;
  license_type: string | null;
  beds: number | null;
  care_category: string;
  serves_memory_care: boolean;
  capacity_tier: string | null;
  last_inspection_date: string | null;
  total_deficiency_count: number | null;
  updated_at: string | null;
};

type StateFacility = {
  id: string;
  name: string;
  url: string;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  state_code: string;
  latitude: number | null;
  longitude: number | null;
  license_number: string | null;
  license_type: string | null;
  beds: number | null;
  care_category: string;
  serves_memory_care: boolean;
  capacity_tier: string | null;
  regulator_url: string | null;
  last_inspection_date: string | null;
  total_deficiency_count: number;
  updated_at: string | null;
};

type ApiPayload = {
  schema: "https://schema.org/Dataset";
  state_code: string;
  state_name: string;
  generated_at: string;
  count: number;
  methodology_url: string;
  facilities: StateFacility[];
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ state: string }> },
) {
  const { state: stateSlug } = await params;

  // Only serve states that are actively published.
  const isCovered = COVERED_STATES.some((s) => s.slug === stateSlug);
  if (!isCovered) {
    return NextResponse.json({ error: "unknown state" }, { status: 404 });
  }

  const stateInfo = stateFromSlug(stateSlug);
  if (!stateInfo) {
    return NextResponse.json({ error: "unknown state" }, { status: 404 });
  }

  const supabase = tryPublicSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "data layer unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("facilities")
    .select(
      "id, name, slug, city_slug, street, city, zip, state_code, " +
      "latitude, longitude, license_number, license_type, beds, " +
      "care_category, serves_memory_care, capacity_tier, " +
      "last_inspection_date, total_deficiency_count, updated_at",
    )
    .eq("state_code", stateInfo.code)
    .eq("publishable", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as FacilityRow[];

  const facilities: StateFacility[] = rows.map((f) => ({
    id: f.id,
    name: f.name,
    url: canonicalFor(`/${stateInfo.slug}/${f.city_slug}/${f.slug}`),
    street: f.street,
    city: f.city,
    postal_code: f.zip,
    state_code: f.state_code,
    latitude: f.latitude != null ? Number(f.latitude) : null,
    longitude: f.longitude != null ? Number(f.longitude) : null,
    license_number: f.license_number,
    license_type: f.license_type,
    beds: f.beds != null ? Number(f.beds) : null,
    care_category: f.care_category,
    serves_memory_care: Boolean(f.serves_memory_care),
    capacity_tier: f.capacity_tier,
    regulator_url: regulatorLicensePageFor(f.state_code, f.license_number),
    last_inspection_date: f.last_inspection_date,
    total_deficiency_count: Number(f.total_deficiency_count ?? 0),
    updated_at: f.updated_at,
  }));

  const payload: ApiPayload = {
    schema: "https://schema.org/Dataset",
    state_code: stateInfo.code,
    state_name: stateInfo.name,
    generated_at: new Date().toISOString(),
    count: facilities.length,
    methodology_url: canonicalFor("/methodology"),
    facilities,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
