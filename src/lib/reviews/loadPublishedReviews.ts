import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import type { Review } from "@/components/reviews/ReviewCard";

export async function loadPublishedReviews(facilityId: string): Promise<Review[]> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return (data ?? []) as Review[];
}
