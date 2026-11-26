/** Answer options shared by the confirm form, its API route, and the profile card. */

export const WANDERING_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "yes_after_assessment", label: "Yes, after an individual assessment" },
  { value: "no", label: "No" },
] as const;

/**
 * Reasons a home may ask a resident to move out. Phrased as the home's policy so
 * a ticked box reads as "we may ask a resident to move out if they ...".
 * Values match the CHECK on facility_direct_responses.move_out_reasons.
 */
export const MOVE_OUT_REASONS = [
  { value: "two_person_transfer", label: "need two people to transfer them" },
  { value: "feeding_tube", label: "need a feeding tube" },
  { value: "aggressive_behavior", label: "are physically aggressive toward others" },
  { value: "exit_seeking", label: "repeatedly try to leave the building" },
  { value: "no_hospice", label: "need hospice care (we do not support it in the home)" },
  { value: "daily_nursing", label: "need daily skilled nursing" },
] as const;

/**
 * Wording the person ticks on the confirm form. Stored as `consent_version`; when
 * either sentence changes, change the version so old rows keep the wording they saw.
 */
export const HOME_CONSENT_VERSION = "2026-11-25";
export const AUTHORIZED_TEXT =
  "I am authorized to answer for this home, and I give StarlynnCare permission to show these answers, with the date, on the home's profile.";
export const PHOTO_PERMISSION_TEXT =
  "I also give StarlynnCare permission to use photos, the logo and a short description from the home's own website and social pages on the home's profile, credited to the home. We can remove them on request.";

export type WanderingValue = (typeof WANDERING_OPTIONS)[number]["value"];
export type MoveOutReason = (typeof MOVE_OUT_REASONS)[number]["value"];

export const MOVE_OUT_VALUES: readonly string[] = MOVE_OUT_REASONS.map((r) => r.value);
export const WANDERING_VALUES: readonly string[] = WANDERING_OPTIONS.map((o) => o.value);

/** Shape the profile card reads from facility_home_response(). */
export type HomeResponse = {
  responded_on: string;
  channel: "email" | "phone" | "form";
  memory_care: "yes" | "no" | null;
  wandering: WanderingValue | null;
  private_pay_low: number | null;
  private_pay_high: number | null;
  medicaid: "yes" | "no" | null;
  medicaid_program: string | null;
  overnight_staff: number | null;
  overnight_residents: number | null;
  move_out_reasons: MoveOutReason[] | null;
  move_out_note: string | null;
};
