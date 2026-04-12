function StarRating({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-sm ${i < score ? "text-amber" : "text-sc-border"}`}>
          ★
        </span>
      ))}
    </span>
  );
}

function DeficiencyRow({
  severity,
  category,
  quote,
  cited,
  corrected,
}: {
  severity: 2 | 3;
  category: string;
  quote: string;
  cited: string;
  corrected: string;
}) {
  const isClass2 = severity === 2;
  return (
    <div
      className="rounded-xl p-4 border-l-4"
      style={{
        backgroundColor: isClass2 ? "#fff5f5" : "#fffbeb",
        borderLeftColor: isClass2 ? "#fc8181" : "#b7791f",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{isClass2 ? "🔴" : "🟡"}</span>
        <span
          className="text-[11px] font-bold uppercase tracking-wide"
          style={{ color: isClass2 ? "#e53e3e" : "#b7791f" }}
        >
          Class {severity} · {category}
        </span>
      </div>
      <p className="text-sm font-mono leading-relaxed text-slate border-l-2 border-teal/30 pl-3 mb-2">
        &ldquo;{quote}&rdquo;
      </p>
      <p className="text-[12px] text-muted">
        Cited: {cited} · Corrected: {corrected}
      </p>
    </div>
  );
}

export default function SampleFacilityCard() {
  return (
    <section className="bg-white py-20 lg:py-28 px-6 lg:px-16">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold tracking-[3px] uppercase text-teal mb-4">
            What You&apos;ll See
          </p>
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.25rem)] leading-[1.2] tracking-[-0.5px] text-navy mb-3">
            The depth of information that changes decisions.
          </h2>
          <p className="text-base text-slate max-w-[500px] mx-auto leading-[1.7]">
            This is what a StarlynnCare facility profile looks like. Every data
            point comes from public inspection records.
          </p>
        </div>

        {/* Facility card */}
        <div
          className="bg-white rounded-2xl border border-sc-border overflow-hidden"
          style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1), 0 16px 40px rgba(0,0,0,0.08)" }}
        >
          {/* Card header */}
          <div className="p-6 lg:p-8 border-b border-sc-border">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Photo placeholder */}
              <div className="w-full sm:w-28 h-24 sm:h-28 rounded-xl bg-gradient-to-br from-teal-light to-warm-white flex items-center justify-center text-3xl flex-shrink-0">
                🏥
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-xl font-semibold text-navy mb-1">
                  Magnolia Ridge Health &amp; Rehabilitation
                </h3>
                <p className="text-muted text-sm mb-4">
                  🏠 Gainesville, FL · Alachua County
                </p>

                {/* Rating grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Overall", score: 3 },
                    { label: "Health", score: 3 },
                    { label: "Staffing", score: 3 },
                    { label: "Fines", score: null, value: "$5,678" },
                  ].map((r) => (
                    <div
                      key={r.label}
                      className="bg-warm-white rounded-xl p-3 text-center border border-sc-border"
                    >
                      <p className="text-[11px] text-muted uppercase tracking-wide mb-1.5">
                        {r.label}
                      </p>
                      {r.score != null ? (
                        <div className="flex justify-center">
                          <StarRating score={r.score} />
                        </div>
                      ) : (
                        <p className="font-semibold text-amber text-sm">{r.value}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Deficiencies */}
          <div className="p-6 lg:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[2px] text-muted mb-4">
              Recent Deficiencies (last 3 inspection cycles)
            </p>
            <div className="space-y-3">
              <DeficiencyRow
                severity={2}
                category="Resident Care & Services"
                quote="Resident found without call light within reach on 3 of 5 observations. Staff unable to explain documented protocol."
                cited="March 2024"
                corrected="April 2024"
              />
              <DeficiencyRow
                severity={3}
                category="Medication Management"
                quote="Medication administration records showed 2 missed doses without documentation."
                cited="March 2024"
                corrected="April 2024"
              />
            </div>

            {/* Actions */}
            <div className="mt-6 pt-5 border-t border-sc-border flex flex-wrap gap-3">
              <button className="bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-teal/90 transition-colors">
                View Full Profile →
              </button>
              <button className="border border-sc-border text-slate text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-warm-white transition-colors">
                Add to Tour List
              </button>
              <button className="border border-sc-border text-slate text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-warm-white transition-colors">
                Set Alert 🔔
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[13px] text-muted mt-4">
          Inspector findings shown verbatim from public AHCA inspection records.
        </p>
      </div>
    </section>
  );
}
