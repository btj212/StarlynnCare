import { getServiceClient } from "@/lib/supabase/server";
import { REVIEW_CATEGORIES, STAR_LABELS } from "@/components/reviews/categories";
import { ModerationButtons } from "./ModerationButtons";
import type { Review } from "@/components/reviews/ReviewCard";

type AdminReview = Review & {
  status: string;
  facility_name: string;
  facility_slug: string;
  state_slug: string;
  city_slug: string;
};

async function loadAllReviews(): Promise<AdminReview[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      *,
      facilities!inner (name, slug, city_slug, state_slug)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin reviews load error:", error);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => {
    const f = r.facilities as { name: string; slug: string; city_slug: string; state_slug: string };
    return {
      ...(r as unknown as AdminReview),
      facility_name: f.name,
      facility_slug: f.slug,
      state_slug: f.state_slug,
      city_slug: f.city_slug,
    };
  });
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3 w-3 ${s <= value ? "text-amber-400" : "text-gray-200"}`}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-[10px] text-gray-400">{STAR_LABELS[value]}</span>
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "pending" } = await searchParams;
  const allReviews = await loadAllReviews();

  const counts = {
    pending: allReviews.filter((r) => r.status === "pending").length,
    published: allReviews.filter((r) => r.status === "published").length,
    rejected: allReviews.filter((r) => r.status === "rejected").length,
  };

  const reviews = allReviews.filter((r) => r.status === filter);

  const tabClass = (tab: string) =>
    `px-4 py-2 text-sm font-medium rounded-md transition ${
      filter === tab
        ? "bg-white shadow-sm text-ink"
        : "text-gray-500 hover:text-ink"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Review moderation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Approve verified family reviews before they appear on facility pages.
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {(["pending", "published", "rejected"] as const).map((tab) => (
          <a key={tab} href={`?filter=${tab}`} className={tabClass(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
              {counts[tab]}
            </span>
          </a>
        ))}
      </div>

      {/* Review list */}
      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No {filter} reviews.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const ratingValues = REVIEW_CATEGORIES.map(
              (cat) => review[`rating_${cat.key}` as keyof Review] as number,
            );
            const overall =
              ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length;
            const date = new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
            }).format(new Date(review.created_at));

            return (
              <div
                key={review.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-ink">{review.reviewer_name}</p>
                    <p className="text-xs text-gray-400">
                      {review.reviewer_relationship}
                      {review.residency_period && ` · ${review.residency_period}`}
                      {" · "}
                      {date}
                    </p>
                    <p className="text-xs font-medium text-teal">
                      <a
                        href={`/${review.state_slug}/${review.city_slug}/${review.facility_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {review.facility_name} ↗
                      </a>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-ink tabular-nums">
                      {overall.toFixed(1)}<span className="text-xs font-normal text-gray-400"> / 5</span>
                    </p>
                    <ModerationButtons reviewId={review.id} status={review.status} />
                  </div>
                </div>

                {/* Overall summary */}
                {review.overall_summary && (
                  <p className="text-sm leading-relaxed text-gray-600 border-l-2 border-teal/30 pl-3">
                    {review.overall_summary}
                  </p>
                )}

                {/* Category breakdown */}
                <div className="grid gap-y-2 gap-x-8 sm:grid-cols-2">
                  {REVIEW_CATEGORIES.map((cat) => {
                    const ratingKey = `rating_${cat.key}` as keyof Review;
                    const commentKey = `comment_${cat.key}` as keyof Review;
                    const rating = review[ratingKey] as number;
                    const comment = review[commentKey] as string | null;
                    return (
                      <div key={cat.key} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-600">
                            {cat.label}
                          </span>
                          <StarRow value={rating} />
                        </div>
                        {comment && (
                          <p className="text-xs text-gray-400 leading-snug">
                            {comment}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
