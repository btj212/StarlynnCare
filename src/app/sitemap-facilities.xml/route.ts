import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import {
  collectFacilityEntries,
  renderUrlset,
} from "@/lib/sitemap/buildSitemapEntries";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = tryPublicSupabaseClient();
  const entries = supabase ? await collectFacilityEntries(supabase) : [];
  const xml = renderUrlset(entries);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
