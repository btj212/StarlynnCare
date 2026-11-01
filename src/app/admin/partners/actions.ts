"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUserIsAdmin } from "@/lib/admin/auth";
import { stateFromCode } from "@/lib/states";
import { isValidEmail } from "@/lib/security/email";
import {
  PARTNER_PHOTO_LIMIT,
  wordCount,
} from "@/lib/partners/constants";
import { isFacilityUuid, loadPartnerGate } from "@/lib/partners/gate";
import {
  cancelPartnerSubscription,
  pausePartnerCollection,
  resumePartnerCollection,
} from "@/lib/partners/billing";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!(await currentUserIsAdmin())) throw new Error("Forbidden");
}

async function revalidateFacility(facilityId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("facilities")
    .select("slug, city_slug, state_code")
    .eq("id", facilityId)
    .maybeSingle();
  revalidatePath("/admin/partners");
  revalidatePath("/partners");
  if (!data) return;
  const state = stateFromCode(data.state_code)?.slug ?? data.state_code.toLowerCase();
  revalidatePath(`/${state}/${data.city_slug}/${data.slug}`);
}

function photosFrom(raw: FormDataEntryValue | null): string[] {
  const lines = String(raw ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > PARTNER_PHOTO_LIMIT) {
    throw new Error(`At most ${PARTNER_PHOTO_LIMIT} photos.`);
  }
  if (lines.some((line) => !line.startsWith("https://"))) {
    throw new Error("Photo URLs must start with https://.");
  }
  return lines;
}

export async function savePartnerProfile(formData: FormData) {
  await requireAdmin();
  const facilityId = String(formData.get("facilityId") ?? "");
  if (!isFacilityUuid(facilityId)) throw new Error("Unknown community.");
  const description = String(formData.get("description") ?? "").trim();
  if (description && wordCount(description) > 150) {
    throw new Error("The description is over 150 words.");
  }
  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  const tourEmail = String(formData.get("tourEmail") ?? "").trim().toLowerCase();
  if (!isValidEmail(contactEmail)) throw new Error("Contact email is invalid.");
  if (tourEmail && !isValidEmail(tourEmail)) throw new Error("Tour email is invalid.");
  const priceMinRaw = String(formData.get("priceMin") ?? "").trim();
  const priceMaxRaw = String(formData.get("priceMax") ?? "").trim();
  const priceMin = priceMinRaw === "" ? null : Number(priceMinRaw);
  const priceMax = priceMaxRaw === "" ? null : Number(priceMaxRaw);
  if ((priceMin == null) !== (priceMax == null)) throw new Error("Enter both prices, or neither.");
  if (priceMin != null && (!Number.isInteger(priceMin) || !Number.isInteger(priceMax) || priceMin < 0 || priceMax! < priceMin)) {
    throw new Error("Prices must be whole dollars, with the low end first.");
  }
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const { error: partnerError } = await supabase
    .from("partners")
    .update({ contact_email: contactEmail, updated_at: now })
    .eq("facility_id", facilityId);
  if (partnerError) throw new Error(partnerError.message);
  const { error } = await supabase.from("partner_profiles").upsert(
    {
      facility_id: facilityId,
      photo_urls: photosFrom(formData.get("photos")),
      price_min: priceMin,
      price_max: priceMax,
      openings_text: String(formData.get("openings") ?? "").trim() || null,
      staffing_day: String(formData.get("staffingDay") ?? "").trim() || null,
      staffing_night: String(formData.get("staffingNight") ?? "").trim() || null,
      description: description || null,
      tour_contact_email: tourEmail || null,
      content_updated_at: now,
      published: formData.get("published") === "on",
      updated_at: now,
    },
    { onConflict: "facility_id" },
  );
  if (error) throw new Error(error.message);
  await revalidateFacility(facilityId);
}

export async function pausePartnerManually(formData: FormData) {
  await requireAdmin();
  const facilityId = String(formData.get("facilityId") ?? "");
  if (!isFacilityUuid(facilityId)) throw new Error("Unknown community.");
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("partners")
    .select("stripe_subscription_id")
    .eq("facility_id", facilityId)
    .maybeSingle();
  if (!data) throw new Error("No partner row.");
  if (data.stripe_subscription_id) await pausePartnerCollection(data.stripe_subscription_id);
  const { error } = await supabase
    .from("partners")
    .update({
      status: "paused",
      pause_reason: "manual",
      collection_paused: Boolean(data.stripe_subscription_id),
      updated_at: new Date().toISOString(),
    })
    .eq("facility_id", facilityId);
  if (error) throw new Error(error.message);
  await revalidateFacility(facilityId);
}

export async function resumePartner(formData: FormData) {
  await requireAdmin();
  const facilityId = String(formData.get("facilityId") ?? "");
  if (!isFacilityUuid(facilityId)) throw new Error("Unknown community.");
  const gate = await loadPartnerGate(facilityId);
  if (!gate?.pass || !gate.publishable) {
    throw new Error("The gate does not pass, so the partnership stays paused.");
  }
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("partners")
    .select("stripe_subscription_id, collection_paused")
    .eq("facility_id", facilityId)
    .maybeSingle();
  if (!data) throw new Error("No partner row.");
  if (data.stripe_subscription_id && data.collection_paused) {
    await resumePartnerCollection(data.stripe_subscription_id);
  }
  const { error } = await supabase
    .from("partners")
    .update({
      status: "active",
      pause_reason: null,
      collection_paused: false,
      updated_at: new Date().toISOString(),
    })
    .eq("facility_id", facilityId);
  if (error) throw new Error(error.message);
  await revalidateFacility(facilityId);
}

export async function endPartnership(formData: FormData) {
  await requireAdmin();
  const facilityId = String(formData.get("facilityId") ?? "");
  if (!isFacilityUuid(facilityId)) throw new Error("Unknown community.");
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("partners")
    .select("stripe_subscription_id")
    .eq("facility_id", facilityId)
    .maybeSingle();
  if (!data) throw new Error("No partner row.");
  if (data.stripe_subscription_id) await cancelPartnerSubscription(data.stripe_subscription_id);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partners")
    .update({
      status: "canceled",
      pause_reason: null,
      collection_paused: false,
      canceled_at: now,
      updated_at: now,
    })
    .eq("facility_id", facilityId);
  if (error) throw new Error(error.message);
  await supabase.from("partner_profiles").update({ published: false, updated_at: now }).eq("facility_id", facilityId);
  await revalidateFacility(facilityId);
}
