"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewState } from "@/app/actions/submitReview";
import { REVIEW_CATEGORIES, RELATIONSHIP_OPTIONS } from "./categories";
import { StarRating } from "./StarRating";

const initialState: ReviewState = { status: "idle" };

export function ReviewForm({ facilityId }: { facilityId: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = submitReview.bind(null, facilityId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (state.status === "success") {
    return (
      <div className="rounded-xl border border-teal/30 bg-teal-light px-6 py-5">
        <p className="font-semibold text-teal">Review submitted</p>
        <p className="mt-1 text-sm text-slate">{state.message}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-sc-border bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-card transition hover:border-teal/40 hover:text-teal"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-teal">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
        Write a review
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {state.status === "error" && state.message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* ── Reviewer info ── */}
      <div className="rounded-xl border border-sc-border bg-white p-6 shadow-card space-y-5">
        <h3 className="font-semibold text-ink">About you</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="reviewer_name" className="block text-sm font-medium text-ink">
              Your name <span className="text-red-500">*</span>
            </label>
            <input
              id="reviewer_name"
              name="reviewer_name"
              type="text"
              required
              maxLength={100}
              className="w-full rounded-md border border-sc-border px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30"
              placeholder="First name or initials"
            />
            {state.fieldErrors?.reviewer_name && (
              <p className="text-xs text-red-600">{state.fieldErrors.reviewer_name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reviewer_relationship" className="block text-sm font-medium text-ink">
              Your relationship <span className="text-red-500">*</span>
            </label>
            <select
              id="reviewer_relationship"
              name="reviewer_relationship"
              required
              className="w-full rounded-md border border-sc-border px-3 py-2 text-sm text-ink bg-white focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value="">Select…</option>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {state.fieldErrors?.reviewer_relationship && (
              <p className="text-xs text-red-600">{state.fieldErrors.reviewer_relationship}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="residency_period" className="block text-sm font-medium text-ink">
            Time period <span className="text-muted text-xs font-normal">(optional)</span>
          </label>
          <input
            id="residency_period"
            name="residency_period"
            type="text"
            maxLength={100}
            className="w-full rounded-md border border-sc-border px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30"
            placeholder="e.g. 2022–2024 or Currently residing"
          />
        </div>
      </div>

      {/* ── Category ratings ── */}
      <div className="rounded-xl border border-sc-border bg-white p-6 shadow-card space-y-6">
        <div>
          <h3 className="font-semibold text-ink">Rate each area</h3>
          <p className="mt-0.5 text-xs text-muted">All categories required. Add a comment to share specifics.</p>
        </div>

        {REVIEW_CATEGORIES.map((cat) => (
          <div key={cat.key} className="space-y-3 border-t border-sc-border/50 pt-5 first:border-t-0 first:pt-0">
            <StarRating
              name={`rating_${cat.key}`}
              label={cat.label}
              description={cat.description}
              error={state.fieldErrors?.[`rating_${cat.key}`]}
            />
            <textarea
              name={`comment_${cat.key}`}
              rows={2}
              maxLength={1000}
              className="w-full rounded-md border border-sc-border px-3 py-2 text-sm text-ink placeholder:text-muted resize-none focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30"
              placeholder={`Anything specific about ${cat.label.toLowerCase()}? (optional)`}
            />
            {state.fieldErrors?.[`comment_${cat.key}`] && (
              <p className="text-xs text-red-600">{state.fieldErrors[`comment_${cat.key}`]}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Email opt-in ── */}
      <div className="rounded-xl border border-sc-border bg-white p-6 shadow-card space-y-2">
        <label htmlFor="reviewer_email" className="block text-sm font-semibold text-ink">
          Email{" "}
          <span className="text-muted text-xs font-normal">(optional)</span>
        </label>
        <input
          id="reviewer_email"
          name="reviewer_email"
          type="email"
          maxLength={254}
          className="w-full rounded-md border border-sc-border px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30"
          placeholder="your@email.com"
        />
        {state.fieldErrors?.reviewer_email && (
          <p className="text-xs text-red-600">{state.fieldErrors.reviewer_email}</p>
        )}
      </div>

      {/* ── Overall summary ── */}
      <div className="rounded-xl border border-sc-border bg-white p-6 shadow-card space-y-2">
        <label htmlFor="overall_summary" className="block text-sm font-semibold text-ink">
          Overall experience <span className="text-muted text-xs font-normal">(optional)</span>
        </label>
        <p className="text-xs text-muted">Anything families should know that the categories don't cover.</p>
        <textarea
          id="overall_summary"
          name="overall_summary"
          rows={4}
          maxLength={2000}
          className="w-full rounded-md border border-sc-border px-3 py-2 text-sm text-ink placeholder:text-muted resize-y focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30"
          placeholder="Share anything else that would have helped you when you were making this decision…"
        />
        {state.fieldErrors?.overall_summary && (
          <p className="text-xs text-red-600">{state.fieldErrors.overall_summary}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-teal px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-mid disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit review"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
        <p className="text-xs text-muted">
          Reviews are moderated before publishing.
        </p>
      </div>
    </form>
  );
}
