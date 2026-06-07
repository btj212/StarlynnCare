import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { collectCoveredStateHubEntries, renderUrlset } from "@/lib/sitemap/buildSitemapEntries";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const supabase = tryPublicSupabaseClient();
  const entries = supabase ? await collectCoveredStateHubEntries(supabase, today) : [];
  const xml = renderUrlset(entries, today);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
