import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import {
  collectStaticSitemapEntries,
  renderUrlset,
  stampCoveredStateHubLastmods,
} from "@/lib/sitemap/buildSitemapEntries";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = tryPublicSupabaseClient();
  const entries = collectStaticSitemapEntries();
  const dated = supabase
    ? await stampCoveredStateHubLastmods(supabase, entries)
    : entries;
  const xml = renderUrlset(dated);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
