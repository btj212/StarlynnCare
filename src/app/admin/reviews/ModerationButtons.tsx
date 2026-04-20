"use client";

import { useTransition } from "react";
import { approveReview, rejectReview } from "@/app/actions/moderateReview";

export function ModerationButtons({
  reviewId,
  status,
}: {
  reviewId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {status !== "published" && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => approveReview(reviewId))}
          className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-mid disabled:opacity-50"
        >
          Approve
        </button>
      )}
      {status !== "rejected" && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => rejectReview(reviewId))}
          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          Reject
        </button>
      )}
      {status === "published" && (
        <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
          Published
        </span>
      )}
      {status === "rejected" && (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">
          Rejected
        </span>
      )}
    </div>
  );
}
