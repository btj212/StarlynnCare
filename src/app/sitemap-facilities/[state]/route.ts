import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import {
  collectFacilityEntriesForState,
  renderUrlset,
} from "@/lib/sitemap/buildSitemapEntries";
import { COVERED_STATES } from "@/lib/states";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Served at /sitemap-facilities-{state}.xml through a rewrite in next.config.ts.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ state: string }> },
) {
  const { state: slug } = await params;
  const state = COVERED_STATES.find((s) => s.slug === slug);
  if (!state) return new NextResponse("Not found", { status: 404 });
  const supabase = tryPublicSupabaseClient();
  const entries = supabase
    ? await collectFacilityEntriesForState(supabase, state.code, state.slug)
    : [];
  return new NextResponse(renderUrlset(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
