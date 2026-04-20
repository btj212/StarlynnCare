"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
}

export async function approveReview(reviewId: string) {
  await requireAdmin();
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("reviews")
    .update({ status: "published" })
    .eq("id", reviewId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reviews");
}

export async function rejectReview(reviewId: string) {
  await requireAdmin();
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("reviews")
    .update({ status: "rejected" })
    .eq("id", reviewId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reviews");
}
