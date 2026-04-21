"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { REVIEW_CATEGORIES, RELATIONSHIP_OPTIONS } from "@/components/reviews/categories";

export type ReviewState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function submitReview(
  facilityId: string,
  _prevState: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  // -- Extract & validate fields --
  const reviewerName = (formData.get("reviewer_name") as string | null)?.trim() ?? "";
  const reviewerRelationship = (formData.get("reviewer_relationship") as string | null) ?? "";
  const residencyPeriod = (formData.get("residency_period") as string | null)?.trim() ?? "";
  const overallSummary = (formData.get("overall_summary") as string | null)?.trim() ?? "";
  const reviewerEmail = (formData.get("reviewer_email") as string | null)?.trim() ?? "";

  const fieldErrors: Record<string, string> = {};

  if (!reviewerName) fieldErrors.reviewer_name = "Please enter your name.";
  if (reviewerName.length > 100) fieldErrors.reviewer_name = "Name must be 100 characters or fewer.";
  if (!RELATIONSHIP_OPTIONS.includes(reviewerRelationship as typeof RELATIONSHIP_OPTIONS[number])) {
    fieldErrors.reviewer_relationship = "Please select your relationship to the resident.";
  }
  if (overallSummary.length > 2000) fieldErrors.overall_summary = "Summary must be 2,000 characters or fewer.";
  if (reviewerEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(reviewerEmail)) {
    fieldErrors.reviewer_email = "Please enter a valid email address.";
  }

  // Validate ratings
  const ratings: Record<string, number> = {};
  for (const cat of REVIEW_CATEGORIES) {
    const raw = formData.get(`rating_${cat.key}`);
    const val = raw ? parseInt(raw as string, 10) : NaN;
    if (isNaN(val) || val < 1 || val > 5) {
      fieldErrors[`rating_${cat.key}`] = `Please rate ${cat.label}.`;
    } else {
      ratings[cat.key] = val;
    }
  }

  // Validate comments
  const comments: Record<string, string> = {};
  for (const cat of REVIEW_CATEGORIES) {
    const val = (formData.get(`comment_${cat.key}`) as string | null)?.trim() ?? "";
    if (val.length > 1000) {
      fieldErrors[`comment_${cat.key}`] = "Comment must be 1,000 characters or fewer.";
    } else {
      comments[cat.key] = val;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the errors below.", fieldErrors };
  }

  // -- Insert --
  const supabase = getServiceClient();

  const { error } = await supabase.from("reviews").insert({
    facility_id: facilityId,
    reviewer_name: reviewerName,
    reviewer_relationship: reviewerRelationship,
    residency_period: residencyPeriod || null,
    overall_summary: overallSummary || null,
    reviewer_email: reviewerEmail || null,
    status: "pending",

    rating_staff_engagement: ratings.staff_engagement,
    rating_personal_care: ratings.personal_care,
    rating_activities: ratings.activities,
    rating_food: ratings.food,
    rating_transparency: ratings.transparency,
    rating_safety: ratings.safety,
    rating_night_weekend: ratings.night_weekend,

    comment_staff_engagement: comments.staff_engagement || null,
    comment_personal_care: comments.personal_care || null,
    comment_activities: comments.activities || null,
    comment_food: comments.food || null,
    comment_transparency: comments.transparency || null,
    comment_safety: comments.safety || null,
    comment_night_weekend: comments.night_weekend || null,
  });

  if (error) {
    console.error("submitReview error:", error);
    return { status: "error", message: "Something went wrong — please try again." };
  }

  return {
    status: "success",
    message:
      "Thank you. Your review has been received and will appear after a brief review by our team.",
  };
}
