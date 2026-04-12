const paths = [
  {
    icon: "🗓️",
    title: "Planning ahead",
    subtitle: "6+ months before placement",
    body: "Memory care waitlists run 6–12 months in most markets. The best facilities fill up fast. Starting early means making a real decision — not just taking what has a bed.",
    features: [
      "Compare facilities side-by-side with inspection history",
      "Generate a custom tour checklist",
      "Set waitlist and inspection alerts",
      "Monthly facility watch updates",
    ],
    cta: "Start comparing →",
    ctaHref: "#waitlist",
    accent: "teal" as const,
  },
  {
    icon: "⚡",
    title: "Need placement soon",
    subtitle: "Days to weeks — hospital discharge or crisis",
    body: "When time is short, the most important thing is a safety floor — not the perfect facility. We filter by what's available, what your insurance covers, and what inspection history says about risks.",
    features: [
      "Available beds filtered by your zip + payer type",
      "Quick safety check: IJ flags, abuse citations, recent fines",
      "5-question tour script you can use today",
      "Clear explanation of tradeoffs",
    ],
    cta: "Get quick guidance →",
    ctaHref: "#waitlist",
    accent: "amber" as const,
  },
];

export default function TwoPathSection() {
  return (
    <section id="two-path" className="bg-warm-white py-20 lg:py-28 px-6 lg:px-16">
      <div className="max-w-[1100px] mx-auto">
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.25rem)] leading-[1.2] tracking-[-0.5px] text-navy text-center mb-12">
          Where are you in the process?
        </h2>

        {/* Cards — crisis first on mobile */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* On mobile, reorder: crisis (index 1) first */}
          {[paths[1], paths[0]].map((path, mobileIdx) => {
            const isAmber = path.accent === "amber";
            return (
              <div
                key={path.title}
                className={`bg-white rounded-2xl border border-sc-border p-7 lg:p-8 flex flex-col ${
                  mobileIdx === 0 ? "order-first md:order-last" : "order-last md:order-first"
                }`}
                style={{
                  borderTop: `3px solid ${isAmber ? "#b7791f" : "#2c7a7b"}`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
                }}
              >
                <div className="text-3xl mb-4">{path.icon}</div>
                <h3 className="font-serif text-xl font-semibold text-navy mb-1">
                  {path.title}
                </h3>
                <p className="text-[13px] text-muted mb-4">{path.subtitle}</p>
                <p className="text-sm leading-[1.7] text-slate mb-5">{path.body}</p>

                <ul className="space-y-2.5 mb-7 flex-1">
                  {path.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate">
                      <span
                        className="mt-0.5 text-xs font-bold flex-shrink-0"
                        style={{ color: isAmber ? "#b7791f" : "#2c7a7b" }}
                      >
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={path.ctaHref}
                  className={`block text-center font-semibold text-sm px-5 py-3 rounded-lg transition-opacity duration-150 hover:opacity-90 ${
                    isAmber ? "bg-amber" : "bg-teal"
                  } text-white`}
                >
                  {path.cta}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
