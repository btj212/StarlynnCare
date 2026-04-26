import { ReviewCard, type Review } from "./ReviewCard";
import { ReviewForm } from "./ReviewForm";
import { REVIEW_CATEGORIES } from "./categories";
import { loadPublishedReviews } from "@/lib/reviews/loadPublishedReviews";

interface CategoryAvg {
  key: string;
  label: string;
  avg: number;
}

function computeCategoryAverages(reviews: Review[]): CategoryAvg[] {
  if (!reviews.length) return [];
  return REVIEW_CATEGORIES.map((cat) => {
    const key = `rating_${cat.key}` as keyof Review;
    const vals = reviews.map((r) => r[key] as number);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { key: cat.key, label: cat.label, avg };
  });
}

function ScoreBar({ value }: { value: number }) {
  const pct = ((value - 1) / 4) * 100;
  const color =
    value >= 4 ? "bg-teal" : value >= 3 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex-1 h-1.5 rounded-full bg-sc-border overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right font-semibold tabular-nums text-ink">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export async function ReviewsSection({
  facilityId,
  initialReviews,
}: {
  facilityId: string;
  /** When provided (e.g. from the facility page), avoids a duplicate Supabase round-trip. */
  initialReviews?: Review[];
}) {
  const reviews =
    initialReviews !== undefined
      ? initialReviews
      : await loadPublishedReviews(facilityId);
  const categoryAverages = computeCategoryAverages(reviews);

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
            Family reviews
          </h2>
          <p className="mt-1 text-sm text-muted">
            {reviews.length > 0
              ? `${reviews.length} verified review${reviews.length === 1 ? "" : "s"} from families`
              : "No reviews yet — be the first to share your experience"}
          </p>
        </div>
        <ReviewForm facilityId={facilityId} />
      </div>

      {/* Summary breakdown */}
      {categoryAverages.length > 0 && (
        <div className="rounded-xl border border-sc-border bg-white p-6 shadow-card">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
            Category averages
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {categoryAverages.map((cat) => (
              <div key={cat.key} className="space-y-1">
                <p className="text-xs font-medium text-ink">{cat.label}</p>
                <ScoreBar value={cat.avg} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual reviews */}
      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-sc-border px-6 py-10 text-center">
          <p className="text-sm text-muted">
            No published reviews yet. Use the button above to share your experience.
          </p>
        </div>
      )}
    </section>
  );
}
