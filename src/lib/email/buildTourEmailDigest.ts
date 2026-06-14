import { canonicalFor } from "@/lib/seo/canonical";
import { getServiceClient } from "@/lib/supabase/server";

const STATE_SLUG: Record<string, string> = {
  CA: "california",
  OR: "oregon",
  WA: "washington",
  MN: "minnesota",
  TX: "texas",
  UT: "utah",
  IL: "illinois",
  PA: "pennsylvania",
};

export type TourEmailDigest = {
  facilityName: string;
  facilityUrl: string;
  cityState: string;
  /** Newline-separated checklist of tour questions prefixed with • */
  tourChecklistText: string;
  /** One-sentence summary of the citation record for context */
  topCitedSummary: string;
  unsubscribeUrl: string;
};

const FALLBACK_QUESTIONS = [
  "What is the staff-to-resident ratio during day shifts and overnight?",
  "How do you handle a resident who becomes physically aggressive?",
  "What is your process when a resident's care needs increase significantly?",
  "How often do families receive updates, and in what format?",
  "What does the monthly fee cover, and what triggers a rate increase?",
];

/**
 * Builds the data payload for the Tour Prep email.
 * Uses facility.content.tour_questions if available; falls back to generic
 * memory care questions so every facility page has a usable checklist.
 */
export async function buildTourEmailDigest(
  facilityId: string,
  unsubscribeToken: string,
): Promise<TourEmailDigest | null> {
  const supabase = getServiceClient();

  const { data: facility, error } = await supabase
    .from("facilities")
    .select("id, name, slug, city, city_slug, state_code, beds, content")
    .eq("id", facilityId)
    .maybeSingle();

  if (error || !facility) {
    console.error("[tour-digest] facility load error:", error?.message ?? "not found");
    return null;
  }

  const stateSlug = STATE_SLUG[facility.state_code] ?? facility.state_code.toLowerCase();
  const facilityUrl = canonicalFor(`/${stateSlug}/${facility.city_slug}/${facility.slug}`);
  const cityState = `${facility.city ?? "—"}, ${facility.state_code}`;
  const unsubscribeUrl = canonicalFor(`/watch/unsubscribe/${unsubscribeToken}`);

  // Use pre-computed tour questions from facility content, or fall back to generic list
  const rawQuestions: string[] =
    (facility.content as { tour_questions?: string[] } | null)?.tour_questions?.filter(
      (q: string) => q.trim(),
    ) ?? FALLBACK_QUESTIONS;

  const questions = rawQuestions.slice(0, 7);
  const tourChecklistText = questions.map((q) => `• ${q}`).join("\n");

  // Short citation context from facility basics (no extra DB query)
  const beds = facility.beds ? `${facility.beds}-bed` : "";
  const topCitedSummary = `${beds ? `A ${beds} memory care facility` : "This facility"} in ${cityState}. Use these questions to compare answers across every facility you tour.`.trim();

  return {
    facilityName: facility.name,
    facilityUrl,
    cityState,
    tourChecklistText,
    topCitedSummary,
    unsubscribeUrl,
  };
}
