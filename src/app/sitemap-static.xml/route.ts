import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { keepApproved, loadApprovedPaths } from "@/lib/content/articleReview";
import {
  collectStaticSitemapEntries,
  renderUrlset,
  stampCoveredStateHubLastmods,
} from "@/lib/sitemap/buildSitemapEntries";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = tryPublicSupabaseClient();
  const approved = await loadApprovedPaths();
  const entries = keepApproved(
    collectStaticSitemapEntries(),
    (entry) => new URL(entry.loc).pathname,
    approved,
  );
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
