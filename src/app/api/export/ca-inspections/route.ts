import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { canonicalFor } from "@/lib/seo/canonical";
import { regulatorLicensePageFor } from "@/lib/seo/schema";

// Revalidate every 6 hours — inspection data refreshes weekly so hourly is wasteful
export const revalidate = 21600;

const CSV_COLUMNS = [
  "facility_id",
  "facility_name",
  "license_number",
  "license_type",
  "care_category",
  "city",
  "zip",
  "beds",
  "latitude",
  "longitude",
  "last_inspection_date",
  "total_deficiency_count",
  "type_a_deficiency_count",
  "starlynncare_url",
  "cdss_source_url",
  "updated_at",
  "data_license",
] as const;

type FacilityRow = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  license_number: string | null;
  license_type: string | null;
  care_category: string;
  city: string | null;
  zip: string | null;
  beds: number | null;
  latitude: string | null;
  longitude: string | null;
  last_inspection_date: string | null;
  updated_at: string;
};

function escapeCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToLine(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCell).join(",");
}

export async function GET() {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) {
    return new Response("Data layer unavailable", { status: 503 });
  }

  const { data, error } = await supabase
    .from("facilities")
    .select(
      "id, name, slug, city_slug, license_number, license_type, care_category, " +
      "city, zip, beds, latitude, longitude, last_inspection_date, updated_at",
    )
    .eq("state_code", "CA")
    .eq("publishable", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[export/ca-inspections]", error.message);
    return new Response("Unable to generate export", { status: 500 });
  }

  const rows = (data ?? []) as unknown as FacilityRow[];

  // Compute total and serious deficiency counts from the inspections + deficiencies tables.
  // total_deficiency_count lives on inspections; serious = class "Type A" or severity >= 3.
  const totalByFac = new Map<string, number>();
  const seriousByFac = new Map<string, number>();
  if (rows.length > 0) {
    const facilityIds = rows.map((f) => f.id);

    const { data: inspData } = await supabase
      .from("inspections")
      .select("id, facility_id, total_deficiency_count")
      .in("facility_id", facilityIds);

    const inspRows = (inspData ?? []) as Array<{
      id: string;
      facility_id: string;
      total_deficiency_count: number | null;
    }>;
    const inspFacMap = new Map<string, string>();
    for (const i of inspRows) {
      inspFacMap.set(i.id, i.facility_id);
      totalByFac.set(
        i.facility_id,
        (totalByFac.get(i.facility_id) ?? 0) + (i.total_deficiency_count ?? 0),
      );
    }

    const inspIds = inspRows.map((i) => i.id);
    if (inspIds.length > 0) {
      const CHUNK = 150;
      for (let ci = 0; ci < inspIds.length; ci += CHUNK) {
        const chunk = inspIds.slice(ci, ci + CHUNK);
        const { data: defData } = await supabase
          .from("deficiencies")
          .select("inspection_id, class, severity")
          .in("inspection_id", chunk);
        for (const d of (defData ?? []) as Array<{
          inspection_id: string;
          class: string | null;
          severity: number | null;
        }>) {
          const fid = inspFacMap.get(d.inspection_id);
          if (!fid) continue;
          const isSerious = d.class === "Type A" || (d.severity ?? 0) >= 3;
          if (isSerious) {
            seriousByFac.set(fid, (seriousByFac.get(fid) ?? 0) + 1);
          }
        }
      }
    }
  }
  const generatedAt = new Date().toISOString().split("T")[0];

  const lines: string[] = [
    // Attribution header — required for CC-BY compliance
    `# California Memory Care Facility Inspection Records — StarlynnCare CC-BY Export`,
    `# Source: California Department of Social Services (CDSS) Community Care Licensing`,
    `# License: Creative Commons Attribution 4.0 International (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/`,
    `# Attribution: StarlynnCare (https://www.starlynncare.com) · Methodology: https://www.starlynncare.com/methodology`,
    `# Generated: ${generatedAt} · Total facilities: ${rows.length}`,
    `# Columns: ${CSV_COLUMNS.join(", ")}`,
    CSV_COLUMNS.join(","),
    ...rows.map((f) =>
      rowToLine([
        f.id,
        f.name,
        f.license_number,
        f.license_type,
        f.care_category,
        f.city,
        f.zip,
        f.beds != null ? Number(f.beds) : null,
        f.latitude != null ? Number(f.latitude) : null,
        f.longitude != null ? Number(f.longitude) : null,
        f.last_inspection_date,
        totalByFac.get(f.id) ?? 0,
        seriousByFac.get(f.id) ?? 0,
        canonicalFor(`/california/${f.city_slug}/${f.slug}`),
        regulatorLicensePageFor("CA", f.license_number),
        f.updated_at.split("T")[0],
        "CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/",
      ]),
    ),
  ];

  const body = lines.join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="starlynncare-ca-memory-care-inspections-${generatedAt}.csv"`,
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin",
      // Suppress Google web-search indexing of the raw CSV while keeping it open
      // for LLM/GEO citation and third-party analysts.
      "X-Robots-Tag": "noindex",
    },
  });
}
