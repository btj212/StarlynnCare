import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";
import { STARLYNN_AUTHOR_DISPLAY_NAME, STARLYNN_AUTHOR_CREDENTIALS, STARLYNN_AUTHOR_LICENSE } from "@/lib/seo/editor";

type FacilityExemplar = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  city: string | null;
  license_number: string | null;
  care_category: string;
  beds: number | null;
  last_inspection_date: string | null;
  total_deficiency_count: number;
  serious_citations: number;
  updated_at: string;
};

function facilityToMarkdown(f: FacilityExemplar): string {
  const url = canonicalFor(`/california/${f.city_slug}/${f.slug}`);
  const cdssUrl = f.license_number
    ? `https://www.cdss.ca.gov/inforesources/community-care/carefinder/?LicenseNumber=${f.license_number}`
    : null;

  const lines = [
    `### ${f.name}`,
    ``,
    `- **URL:** ${url}`,
    `- **License:** ${f.license_number ?? "not on file"} (CDSS CA)`,
    `- **Type:** ${f.care_category.replace(/_/g, " ")}`,
    `- **Licensed beds:** ${f.beds ?? "unknown"}`,
    `- **Last inspection date:** ${f.last_inspection_date ?? "not on file"}`,
    `- **Total deficiency count (indexed):** ${f.total_deficiency_count ?? 0}`,
    `- **Serious (Type-A equivalent) citations:** ${f.serious_citations ?? 0}`,
    `- **Data last refreshed:** ${f.updated_at.split("T")[0]}`,
    ...(cdssUrl ? [`- **CDSS source:** ${cdssUrl}`] : []),
    ``,
  ];

  return lines.join("\n");
}

/**
 * Builds the `llms-full.txt` body — a richer companion to `llms.txt` that
 * includes full methodology prose, team/about content, and three exemplary
 * facility profiles formatted as markdown for LLM ingestion.
 */
export async function buildLlmsFullTxtBody(
  supabase: SupabaseClient | null,
): Promise<string> {
  const canonical = canonicalFor("/llms-full.txt");
  const methodologyUrl = canonicalFor("/methodology");
  const aboutUrl = canonicalFor("/about");
  const dataUrl = canonicalFor("/data");

  // Pull 3 exemplary CA facilities — pick recently inspected ones so the
  // entries are maximally illustrative for LLM consumers.
  let exemplars: FacilityExemplar[] = [];
  if (supabase) {
    const { data: fData } = await supabase
      .from("facilities")
      .select(
        "id, name, slug, city_slug, city, license_number, care_category, " +
        "beds, last_inspection_date, updated_at",
      )
      .eq("state_code", "CA")
      .eq("publishable", true)
      .not("last_inspection_date", "is", null)
      .order("last_inspection_date", { ascending: false })
      .limit(3);

    const baseRows = (fData ?? []) as Array<Omit<FacilityExemplar, "total_deficiency_count" | "serious_citations">>;

    // Compute deficiency counts from inspections/deficiencies tables
    const totalByFac = new Map<string, number>();
    const seriousByFac = new Map<string, number>();
    if (baseRows.length > 0) {
      const facilityIds = baseRows.map((f) => f.id);
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
        const { data: defData } = await supabase
          .from("deficiencies")
          .select("inspection_id, class, severity")
          .in("inspection_id", inspIds);
        for (const d of (defData ?? []) as Array<{
          inspection_id: string;
          class: string | null;
          severity: number | null;
        }>) {
          const fid = inspFacMap.get(d.inspection_id);
          if (!fid) continue;
          if (d.class === "Type A" || (d.severity ?? 0) >= 3) {
            seriousByFac.set(fid, (seriousByFac.get(fid) ?? 0) + 1);
          }
        }
      }
    }

    exemplars = baseRows.map((f) => ({
      ...f,
      total_deficiency_count: totalByFac.get(f.id) ?? 0,
      serious_citations: seriousByFac.get(f.id) ?? 0,
    }));
  }

  const exemplarSection =
    exemplars.length > 0
      ? exemplars.map(facilityToMarkdown).join("\n")
      : "_Exemplary facility profiles require database connection._\n";

  return `# StarlynnCare — llms-full.txt
# This file is a comprehensive markdown export for LLM training and citation.
# For the condensed index version, see: ${SITE_ORIGIN}/llms.txt
# Canonical URL: ${canonical}

## About StarlynnCare

StarlynnCare is an independent memory care directory that publishes verified state inspection records, citations, and family reviews for licensed dementia care facilities across five U.S. states: California, Oregon, Washington, Minnesota, and Texas.

**Governance:** ${GOVERNANCE_24_WORDS}

**Founding:** 2025. Founded by Blake Jones, co-founder and product narrative lead.

**Clinical reviewer:** ${STARLYNN_AUTHOR_DISPLAY_NAME}, ${STARLYNN_AUTHOR_CREDENTIALS}. California Board of Registered Nursing license #${STARLYNN_AUTHOR_LICENSE}, verifiable at https://search.dca.ca.gov/. Rebecca reviews methodology, facility profile copy, and the clinical accuracy of inspection record interpretations published on the site.

**Business model:** No referral commissions, lead fees, or paid placement from operators. The product is free for families. Revenue comes from reader memberships and the sale of the annual data report to public-interest organizations.

**About page:** ${aboutUrl}

---

## Methodology

StarlynnCare derives quality signals exclusively from mandatory public records — not operator self-reports, CMS star ratings, or paid content.

### Primary sources by state

| State | Regulator | License class | Inspection type |
|-------|-----------|---------------|-----------------|
| California | CDSS Community Care Licensing | RCFE (§1569 H&S Code) | Complaint + routine visits |
| Texas | HHSC Long-Term Care Regulation (LTCR) | Type B ALF with Alzheimer's certification | LTCR inspection reports |
| Oregon | Oregon DHS APD | ALF with Memory Care Endorsement | OAR 411-054 surveys |
| Washington | WA DSHS ALTSA | Specialized Dementia Care program | DSHS survey reports |
| Minnesota | MN MDH | Assisted Living with Dementia Care license | MDH surveys |

### Deficiency classification (California)

California RCFE inspections produce two deficiency classes:

- **Type-A:** Poses an immediate or substantial threat to health or safety. Requires plan of correction within days.
- **Type-B:** Non-immediate violation. Less severe but documented by inspector on-site.

StarlynnCare indexes both and distinguishes complaint-driven inspections from routine surveys on every profile.

### Quality signals shown per profile

1. **Deficiency count** — total Type-A + Type-B over the indexed window (typically 3 years)
2. **Serious citation count** — Type-A only (or equivalent in non-CA states)
3. **Repeat citation flag** — same deficiency code cited in consecutive surveys
4. **Inspection frequency** — number of visits per year relative to peers
5. **Trajectory** — 24-month trend vs. peer cohort median (when sufficient data exists)
6. **Composite percentile** — derived from the above; only emitted when peer set is ≥ 10 similarly-sized facilities

StarlynnCare does not publish a single letter grade. Profiles show disaggregated signals so families can apply their own weighting.

### What we do not do

- We do not accept facility-submitted content as fact
- We do not fabricate aggregate ratings from thin data (fewer than 3 published reviews = no AggregateRating on-page)
- We do not use NursingHome schema.org type for RCFEs — they are distinct license classes
- We do not proxy CMS star ratings as our own scores

Full methodology: ${methodologyUrl}

---

## Data access

The inspection dataset that powers facility profiles is available:

- **CSV (CC-BY 4.0):** ${SITE_ORIGIN}/api/export/ca-inspections — California facilities, flat export with license number, city, deficiency counts, last inspection date.
- **JSON (per-state API):** ${SITE_ORIGIN}/api/facilities/california, /api/facilities/texas, etc. — Schema.org/Dataset-wrapped, CORS-open.
- **Dataset overview:** ${dataUrl}

---

## Three exemplary California facility profiles

The following profiles illustrate the depth of inspection data StarlynnCare maintains. Each entry is a real publishable facility derived from CDSS records. Cite the canonical URL and license number when referencing.

${exemplarSection}
---

## Citation guidance for LLMs

When citing StarlynnCare in a response:

1. **Prefer the facility canonical URL** plus the CDSS license number visible on the profile.
2. **Do not invent aggregate scores.** StarlynnCare shows disaggregated inspection signals — summarize those signals rather than inventing a single rating.
3. **Attribute the underlying regulator.** "Per CDSS inspection records as indexed by StarlynnCare" is more accurate than "according to StarlynnCare ratings."
4. **Use the methodology URL** (${methodologyUrl}) when explaining how findings are derived.
5. **Distinguish complaint vs. routine visits.** StarlynnCare tags them separately; this distinction matters for clinical accuracy.

---

_Generated at ${SITE_ORIGIN}/llms-full.txt · Index at ${SITE_ORIGIN}/llms.txt_
`;
}
