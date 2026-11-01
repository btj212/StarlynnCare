import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { formatFacilityName } from "@/lib/facility/displayName";
import { stateFromCode } from "@/lib/states";
import { isFacilityUuid, loadPartnerGate } from "@/lib/partners/gate";

export const runtime = "nodejs";

type SearchRow = {
  id: string;
  name: string;
  city: string | null;
  city_slug: string;
  state_code: string;
  slug: string;
};

function cleanQuery(value: string): string {
  return value.replace(/[%_,()]/g, "").trim().slice(0, 80);
}

export async function GET(req: NextRequest) {
  const limit = await rateLimit(`partner-eligibility:${clientIp(req)}`, 30, 10 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const facilityId = req.nextUrl.searchParams.get("facilityId")?.trim() ?? "";
  const q = cleanQuery(req.nextUrl.searchParams.get("q") ?? "");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Eligibility lookup is unavailable." }, { status: 503 });
  }

  if (facilityId) {
    if (!isFacilityUuid(facilityId)) {
      return NextResponse.json({ error: "Unknown community." }, { status: 400 });
    }
    const supabase = getServiceClient();
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name, city, city_slug, state_code, slug, publishable")
      .eq("id", facilityId)
      .maybeSingle();
    if (!facility?.publishable) {
      return NextResponse.json({ error: "Unknown community." }, { status: 404 });
    }
    const gate = await loadPartnerGate(facilityId);
    if (!gate) {
      return NextResponse.json({ error: "Eligibility could not be checked." }, { status: 503 });
    }
    const state = stateFromCode(facility.state_code);
    return NextResponse.json({
      facility: {
        id: facility.id,
        name: formatFacilityName(facility.name),
        city: facility.city,
        path: `/${state?.slug ?? facility.state_code.toLowerCase()}/${facility.city_slug}/${facility.slug}`,
      },
      gate: {
        pass: gate.pass && gate.publishable,
        rules: gate.rules,
      },
    });
  }

  if (q.length < 3) {
    return NextResponse.json({ matches: [] });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("facilities")
    .select("id, name, city, city_slug, state_code, slug")
    .eq("publishable", true)
    .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
    .order("name")
    .limit(20);
  if (error) {
    console.error("[partners] search failed:", error.message);
    return NextResponse.json({ error: "Search is unavailable." }, { status: 503 });
  }

  const matches = ((data ?? []) as SearchRow[]).map((row) => {
    const state = stateFromCode(row.state_code);
    return {
      id: row.id,
      name: formatFacilityName(row.name),
      city: row.city,
      state: state?.name ?? row.state_code,
      path: `/${state?.slug ?? row.state_code.toLowerCase()}/${row.city_slug}/${row.slug}`,
    };
  });
  return NextResponse.json({ matches });
}
