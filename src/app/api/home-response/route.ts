import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD, looksLikeBot } from "@/lib/security/honeypot";
import { HOME_CONSENT_VERSION, MOVE_OUT_VALUES, WANDERING_VALUES } from "@/lib/facility/homeResponse";
import {
  emailDomainMatchesWebsite,
  parseListingChecks,
  shownListingFacts,
  verifyOutreachToken,
  type ListingFacility,
} from "@/lib/facility/homeOutreach";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


function int(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

function httpUrl(value: unknown): string | null {
  const t = text(value, 500);
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * A home answers our questions. The row is stored as 'pending' and is not shown
 * to anyone until a person has checked who sent it. Memory-care program fields
 * never write facilities.mc_program_confirmed.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimit(`home-response:${clientIp(request)}`, 5, 15 * 60);
    if (!limit.allowed) return fail("Too many requests. Please try again later.", 429);

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) return fail("Invalid request");
    const b = body as Record<string, unknown>;

    if (looksLikeBot(b[HONEYPOT_FIELD] as string | undefined, b[HONEYPOT_TS_FIELD] as string | undefined)) {
      return NextResponse.json({ success: true });
    }

    const facilityId = text(b.facilityId, 64);
    const email = text(b.respondentEmail, 255);
    if (!facilityId) return fail("Facility is required");
    if (!email || !EMAIL.test(email)) {
      return fail("A work email is required so we can check the answers came from the home.");
    }

    if (b.authorized !== true) return fail("Please confirm you are authorized to answer for this home.");
    const photoPermission = b.photoPermission === true;
    const photoLink = httpUrl(b.photoLink);
    if (text(b.photoLink, 500) && !photoLink) return fail("The photo link must start with http:// or https://.");

    const memoryCare = b.memoryCare === "yes" || b.memoryCare === "no" ? b.memoryCare : null;
    const wandering = typeof b.wandering === "string" && WANDERING_VALUES.includes(b.wandering) ? b.wandering : null;
    const medicaid = b.medicaid === "yes" || b.medicaid === "no" ? b.medicaid : null;
    const medicaidProgram = medicaid === "yes" ? text(b.medicaidProgram, 60) : null;

    const low = int(b.privatePayLow, 500, 30000);
    const high = int(b.privatePayHigh, 500, 30000);
    if ((low === null) !== (high === null)) return fail("Enter both ends of the monthly price range, or neither.");
    if (low !== null && high !== null && high < low) return fail("The top of the price range is below the bottom.");

    const staff = int(b.overnightStaff, 0, 50);
    const residents = int(b.overnightResidents, 1, 500);
    if ((staff === null) !== (residents === null)) return fail("Enter both overnight staff and residents, or neither.");

    const reasons = Array.isArray(b.moveOutReasons)
      ? [...new Set(b.moveOutReasons.filter((r): r is string => typeof r === "string" && MOVE_OUT_VALUES.includes(r)))]
      : [];
    const moveOutNote = text(b.moveOutNote, 400);

    const mcSecured =
      memoryCare === "yes" && (b.mcSecured === "yes" || b.mcSecured === "no") ? b.mcSecured : null;
    const mcProgramName = memoryCare === "yes" ? text(b.mcProgramName, 120) : null;
    const mcProgramUrl = memoryCare === "yes" ? httpUrl(b.mcProgramUrl) : null;
    if (memoryCare === "yes" && text(b.mcProgramUrl, 500) && !mcProgramUrl) {
      return fail("The program link must start with http:// or https://.");
    }

    const supabase = getServiceClient();
    const { data: facility, error: facilityError } = await supabase
      .from("facilities")
      .select("*")
      .eq("id", facilityId)
      .eq("publishable", true)
      .maybeSingle();
    if (facilityError || !facility) return fail("Facility not found", 404);

    const row = facility as ListingFacility & { id: string; name: string; website: string | null };
    const shown = shownListingFacts(row);
    const parsed = parseListingChecks(b.listingChecks, shown);
    if ("error" in parsed) return fail(parsed.error);

    const outreachTokenValid = verifyOutreachToken(text(b.outreachToken, 500), row.id);
    const emailDomainMatches = emailDomainMatchesWebsite(email, row.website);

    const { data: saved, error } = await supabase
      .from("facility_direct_responses")
      .insert({
        facility_id: row.id,
        responded_on: new Date().toISOString().slice(0, 10),
        channel: "form",
        status: "pending",
        respondent_name: text(b.respondentName, 100),
        respondent_email: email.toLowerCase(),
        memory_care: memoryCare,
        wandering,
        private_pay_low: low,
        private_pay_high: high,
        medicaid,
        medicaid_program: medicaidProgram,
        overnight_staff: staff,
        overnight_residents: residents,
        move_out_reasons: reasons.length > 0 ? reasons : null,
        move_out_note: moveOutNote,
        authorized_to_answer: true,
        photo_permission: photoPermission,
        photo_link: photoLink,
        consent_version: HOME_CONSENT_VERSION,
        listing_checks: parsed.checks,
        mc_secured: mcSecured,
        mc_program_name: mcProgramName,
        mc_program_url: mcProgramUrl,
        outreach_token_valid: outreachTokenValid,
        email_domain_matches: emailDomainMatches,
      })
      .select("id")
      .single();
    if (error || !saved) {
      console.error("[home-response] insert failed:", error?.message);
      return fail("Could not save your answers. Please try again.", 500);
    }

    recordSubmission({
      type: "home_response",
      email: email.toLowerCase(),
      facilityId: row.id,
      source: "confirm_form",
      summary: `${row.name} · home response (pending review)`,
      payload: {
        responseId: saved.id,
        respondentName: text(b.respondentName, 100),
        photoPermission,
        photoLink,
        outreachTokenValid,
        emailDomainMatches,
        listingAllCorrect: parsed.checks.allCorrectShortcut,
        listingFixes: listingFixKeys(parsed.checks),
        mcSecured,
        mcProgramName,
        mcProgramUrl,
        doNotAutoPublishLevel2: true,
      },
    }).catch((err) => console.error("[home-response] recordSubmission failed:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[home-response] error:", error);
    return fail("Internal server error", 500);
  }
}

function listingFixKeys(checks: {
  fields: Record<string, { verdict: string; correction: string | null }>;
}): string[] {
  return Object.entries(checks.fields)
    .filter(([, v]) => v.verdict === "fix")
    .map(([k]) => k);
}
