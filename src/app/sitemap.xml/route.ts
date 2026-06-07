import { NextResponse } from "next/server";
import { renderSitemapIndex } from "@/lib/sitemap/buildSitemapEntries";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const xml = renderSitemapIndex(
    ["/sitemap-static.xml", "/sitemap-hubs.xml", "/sitemap-facilities.xml"],
    today,
  );
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
