import type { Region } from "@/lib/regions";
import { canonicalFor } from "@/lib/seo/canonical";

export interface CityFaqInputs {
  totalCount: number;
  /** Facilities with at least one Type-A/Type-B–level finding (serious citations) in indexed data */
  facilitiesWithDeficiency: number;
}

export interface FaqPair {
  q: string;
  a: string;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/**
 * Q&A pairs for city/county hub pages — matches visible FAQ section and FAQPage JSON-LD.
 * Copy adapted from StarlynnCare_City_FAQ_Sets.md with correct internal URLs.
 */
export function buildCityFaqs(region: Region, inputs: CityFaqInputs): FaqPair[] {
  const { totalCount, facilitiesWithDeficiency } = inputs;
  const severePct = pct(facilitiesWithDeficiency, totalCount);
  const cityName = region.name;
  const isCounty = region.kind === "county";
  const costGuideUrl = canonicalFor("/california/cost-guide");
  const tourUrl = canonicalFor("/california/37-questions-to-ask-on-a-tour");
  const alwUrl = "https://www.cdss.ca.gov/assisted-living-waiver";

  const costQ: FaqPair = isCounty
    ? {
        q: `How much does memory care cost across ${cityName}?`,
        a: `Memory care across ${cityName} runs from roughly $4,500/month at smaller RCFEs in lower-cost cities to $12,000+/month at premium memory-specific buildings. Median sits around $6,500–$8,000/month for a private room with standard care needs. Full bills almost always exceed the advertised base rate; most California facilities use “level of care” point systems adding $500–$2,500/month. Click into any city below for a tighter range, or read What memory care costs in California (${costGuideUrl}).`,
      }
    : {
        q: `How much does memory care cost in ${cityName}?`,
        a: `Memory care in ${cityName} typically runs $5,000–$9,000/month, depending on level of care, room type, and licensing tier. The full bill almost always exceeds the advertised base rate. Most California facilities use “level of care” point systems adding $500–$2,500/month for residents needing more support with bathing, medication, or mobility. For statewide ranges and financing context, see What memory care costs in California (${costGuideUrl}).`,
      };

  return [
    costQ,
    {
      q: 'What makes a facility "memory care" in California?',
      a: `California has no separate memory care license. The facilities here are CDSS-licensed Residential Care Facilities for the Elderly (RCFEs) under Section 1569 of the Health & Safety Code. To advertise as memory care, an RCFE files a Memory Care Disclosure with CDSS and meets additional requirements around staff training, secured perimeters, and dementia programming. Some facilities here are skilled nursing facilities (SNFs) with a dementia or secure unit — a different license entirely (Title 22, Division 5). License type appears on every StarlynnCare profile.`,
    },
    {
      q: "What's the difference between an RCFE and a nursing home?",
      a: `RCFEs provide non-medical care: room, board, supervision, ADL help, medication assistance. Nursing homes (SNFs) provide medical care: licensed nurses on staff 24/7, medication administration (not just assistance), wound care, rehab. Most California memory care indexed here lives in RCFEs. If your family member needs ongoing skilled nursing — feeding tubes, IV medications, complex wound care — an RCFE memory unit may not fit.`,
    },
    {
      q: `How many ${cityName} facilities have a serious deficiency on file?`,
      a:
        totalCount === 0
          ? `StarlynnCare has not yet indexed publishable facilities for ${cityName}.`
          : `Of the ${totalCount} licensed memory care facilities indexed in ${cityName}, ${facilitiesWithDeficiency} (${severePct}%) carry a Type-A or Type-B deficiency from CDSS in the indexed inspection record (past 24 months where dated). Type-A indicates immediate health or safety risk; Type-B indicates a lesser violation. Both are public record. Specific citations appear on each profile with inspection date and source link.`,
    },
    {
      q: `What should I look for on a memory care tour in ${cityName}?`,
      a: `What predicts safety usually isn't what admissions directors highlight. From clinician and family interviews, the most under-asked items: staff-to-resident ratio at night and on weekends, skin-check and wound-prevention protocol, medication management and error reporting, shower frequency, and how the facility handles behavioral escalation. We publish a free 37-question tour checklist you can print (${tourUrl}).`,
    },
    {
      q: `Does Medi-Cal cover memory care in ${cityName}?`,
      a: `Traditional Medi-Cal does not cover room and board in an RCFE memory care setting. The Assisted Living Waiver (ALW) can cover services in participating RCFEs for income-qualified residents, but waitlists are long and the program runs in a limited set of counties — whether ${cityName} is in an ALW service area depends on county (see ${alwUrl}). Medi-Cal does cover skilled nursing care in a Medi-Cal-certified SNF, including SNF dementia units, for residents meeting medical eligibility. Each facility profile documents payment acceptance when known.`,
    },
  ];
}
