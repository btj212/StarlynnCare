import { NextResponse } from "next/server";
import { lookupFacilities, normalizeLookupQuery } from "@/lib/data/facilityLookup";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { COVERED_STATES, stateFromSlug } from "@/lib/states";

export const revalidate = 3600;

const HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  Vary: "Origin",
  "X-Robots-Tag": "noindex",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ state: string }> },
) {
  const { state: stateSlug } = await params;
  if (!COVERED_STATES.some((state) => state.slug === stateSlug)) {
    return NextResponse.json({ error: "unknown state" }, { status: 404, headers: HEADERS });
  }
  const stateInfo = stateFromSlug(stateSlug);
  if (!stateInfo) {
    return NextResponse.json({ error: "unknown state" }, { status: 404, headers: HEADERS });
  }

  const query = normalizeLookupQuery(new URL(req.url).searchParams.get("q") ?? "");
  if (!query) {
    return NextResponse.json(
      { error: "q must be 3 to 80 characters of a home name or license number" },
      { status: 400, headers: HEADERS },
    );
  }

  const supabase = tryPublicSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "data layer unavailable" }, { status: 503, headers: HEADERS });
  }

  const result = await lookupFacilities(supabase, {
    stateCode: stateInfo.code,
    stateSlug: stateInfo.slug,
    query,
  });
  if (!result.ok) {
    console.error("[facility-lookup]", stateInfo.code, "query failed");
    return NextResponse.json(
      { error: "Unable to look up facilities" },
      { status: 500, headers: HEADERS },
    );
  }

  return NextResponse.json(
    {
      state_code: stateInfo.code,
      query,
      count: result.matches.length,
      matches: result.matches,
    },
    { headers: HEADERS },
  );
}
