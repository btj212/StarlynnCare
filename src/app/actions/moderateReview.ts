"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUserIsAdmin } from "@/lib/admin/auth";

/**
 * Belt-and-suspenders admin check (audit H7): the proxy.ts middleware
 * already gates /admin/* by ADMIN_EMAILS, but server actions resolve via the
 * same matcher Next.js applies to page routes — so any future middleware
 * bypass CVE would expose these mutations to any signed-in Clerk user.
 * Re-check the allowlist here.
 */
async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!(await currentUserIsAdmin())) throw new Error("Forbidden");
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
