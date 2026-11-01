import { getServiceClient } from "@/lib/supabase/server";
import { stateFromCode } from "@/lib/states";
import { formatFacilityName } from "@/lib/facility/displayName";
import {
  PARTNER_DESCRIPTION_WORD_LIMIT,
  PARTNER_PHOTO_LIMIT,
  PARTNER_TOUR_CONSENT_VERSION,
  partnerPanelIsPublic,
  partnerPricesAreFresh,
  partnerProvidedLabel,
  partnerTourConsent,
  wordCount,
} from "@/lib/partners/constants";
import { loadPartnerGate } from "@/lib/partners/gate";

export type PublicPartnerPanel = {
  facilityId: string;
  communityName: string;
  facilityPath: string;
  label: string;
  consentText: string;
  consentVersion: string;
  photos: string[];
  priceLabel: string | null;
  openings: string | null;
  staffingDay: string | null;
  staffingNight: string | null;
  description: string | null;
  pricesFresh: boolean;
};

type ProfileRow = {
  photo_urls: string[] | null;
  price_min: number | null;
  price_max: number | null;
  openings_text: string | null;
  staffing_day: string | null;
  staffing_night: string | null;
  description: string | null;
  content_updated_at: string | null;
  published: boolean;
};

function dollars(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function priceLabel(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null;
  if (min === max) return `${dollars(min)} a month`;
  return `${dollars(min)}–${dollars(max)} a month`;
}

function photos(urls: string[] | null): string[] {
  return (urls ?? [])
    .filter((url) => url.startsWith("https://"))
    .slice(0, PARTNER_PHOTO_LIMIT);
}

function description(text: string | null): string | null {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/);
  if (words.length <= PARTNER_DESCRIPTION_WORD_LIMIT) return trimmed;
  return words.slice(0, PARTNER_DESCRIPTION_WORD_LIMIT).join(" ");
}

export async function loadPublicPartnerPanel(
  facilityId: string,
): Promise<PublicPartnerPanel | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  try {
    const supabase = getServiceClient();
    const { data: partner, error } = await supabase
      .from("partners")
      .select("status")
      .eq("facility_id", facilityId)
      .maybeSingle();
    if (error || !partner || partner.status !== "active") return null;

    const { data: facility } = await supabase
      .from("facilities")
      .select("name, slug, city_slug, state_code, publishable")
      .eq("id", facilityId)
      .maybeSingle();
    if (!facility?.publishable) return null;

    const { data: profile } = await supabase
      .from("partner_profiles")
      .select(
        "photo_urls, price_min, price_max, openings_text, staffing_day, staffing_night, description, content_updated_at, published",
      )
      .eq("facility_id", facilityId)
      .maybeSingle();
    const row = profile as ProfileRow | null;
    if (!row?.published) return null;

    const gate = await loadPartnerGate(facilityId);
    const communityName = formatFacilityName(facility.name);
    if (
      !gate ||
      !partnerPanelIsPublic({
        status: partner.status,
        published: row.published,
        gatePass: gate.pass,
        facilityPublishable: facility.publishable === true,
      })
    ) {
      return null;
    }

    const fresh = partnerPricesAreFresh(row.content_updated_at);
    const stateSlug =
      stateFromCode(facility.state_code)?.slug ?? String(facility.state_code).toLowerCase();
    return {
      facilityId,
      communityName,
      facilityPath: `/${stateSlug}/${facility.city_slug}/${facility.slug}`,
      label: partnerProvidedLabel(communityName),
      consentText: partnerTourConsent(communityName),
      consentVersion: PARTNER_TOUR_CONSENT_VERSION,
      photos: photos(row.photo_urls),
      priceLabel: fresh ? priceLabel(row.price_min, row.price_max) : null,
      openings: fresh ? row.openings_text : null,
      staffingDay: row.staffing_day,
      staffingNight: row.staffing_night,
      description: description(row.description),
      pricesFresh: fresh,
    };
  } catch (err) {
    console.error("[partners] public panel failed:", err);
    return null;
  }
}

export function descriptionWithinLimit(text: string): boolean {
  return wordCount(text) <= PARTNER_DESCRIPTION_WORD_LIMIT;
}
