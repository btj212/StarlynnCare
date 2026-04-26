interface TourQuestionsProps {
  questions: string[];
  facilityName: string;
}

export function TourQuestions({ questions, facilityName }: TourQuestionsProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <section
      aria-labelledby="tour-questions-heading"
      className="mt-10 rounded-xl border border-teal/25 bg-teal-light/40 px-6 py-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal text-white"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
        </span>

        <div className="flex-1 min-w-0">
          <h2
            id="tour-questions-heading"
            className="font-[family-name:var(--font-sans)] text-xl font-semibold text-navy leading-snug"
          >
            Questions to ask on your tour
          </h2>
          <p className="mt-1 text-sm text-slate">
            Based on {facilityName}&apos;s state inspection record.
          </p>

          <ol className="mt-5 space-y-4">
            {questions.map((q, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal text-[11px] font-bold leading-none"
                >
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink">{q}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
