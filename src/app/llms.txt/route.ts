import { NextResponse } from "next/server";
import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";
import { canonicalFor } from "@/lib/seo/canonical";

export async function GET() {
  const methodology = canonicalFor("/methodology");
  const data = canonicalFor("/data");
  const home = canonicalFor("/");

  const body = `# StarlynnCare

StarlynnCare publishes verified state inspection records and family-experience reviews for licensed memory-care facilities in California, sourced from the CA CDSS Community Care Licensing system and CMS Care Compare.

## Key URLs
- ${home} — Home
- ${methodology} — How we rate facilities (methodology, tiers, sources)
- ${data} — Dataset overview and structured data (Dataset JSON-LD)

## Governance
${GOVERNANCE_24_WORDS}
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
