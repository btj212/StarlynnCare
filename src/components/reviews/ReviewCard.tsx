import { REVIEW_CATEGORIES, STAR_LABELS } from "./categories";

export interface Review {
  id: string;
  reviewer_name: string;
  reviewer_relationship: string;
  residency_period: string | null;
  overall_summary: string | null;
  created_at: string;
  rating_staff_engagement: number;
  rating_personal_care: number;
  rating_activities: number;
  rating_food: number;
  rating_transparency: number;
  rating_safety: number;
  rating_night_weekend: number;
  comment_staff_engagement: string | null;
  comment_personal_care: string | null;
  comment_activities: string | null;
  comment_food: string | null;
  comment_transparency: string | null;
  comment_safety: string | null;
  comment_night_weekend: string | null;
}

function StarDisplay({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3.5 w-3.5 ${s <= value ? "text-amber-400" : "text-sc-border"}`}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-[10px] text-muted">{STAR_LABELS[value]}</span>
    </span>
  );
}

function avg(vals: number[]) {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function ReviewCard({ review }: { review: Review }) {
  const ratings = [
    review.rating_staff_engagement,
    review.rating_personal_care,
    review.rating_activities,
    review.rating_food,
    review.rating_transparency,
    review.rating_safety,
    review.rating_night_weekend,
  ];
  const overall = avg(ratings);

  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(review.created_at),
  );

  return (
    <div className="rounded-xl border border-sc-border bg-white p-6 shadow-card space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-ink">{review.reviewer_name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {review.reviewer_relationship}
            {review.residency_period && ` · ${review.residency_period}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-base font-bold text-ink tabular-nums">
              {overall.toFixed(1)}
            </span>
            <span className="text-xs text-muted">/ 5</span>
          </div>
          <p className="text-[10px] text-muted">{date}</p>
        </div>
      </div>

      {/* Overall summary */}
      {review.overall_summary && (
        <p className="text-sm leading-relaxed text-slate">{review.overall_summary}</p>
      )}

      {/* Category breakdown */}
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {REVIEW_CATEGORIES.map((cat) => {
          const ratingKey = `rating_${cat.key}` as keyof Review;
          const commentKey = `comment_${cat.key}` as keyof Review;
          const rating = review[ratingKey] as number;
          const comment = review[commentKey] as string | null;

          return (
            <div key={cat.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink">{cat.label}</span>
                <StarDisplay value={rating} />
              </div>
              {comment && (
                <p className="text-xs text-slate leading-relaxed">{comment}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
