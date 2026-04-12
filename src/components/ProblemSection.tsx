const painPoints = [
  {
    icon: "⏰",
    title: "Decisions in 24–72 hours",
    body: "Hospital discharge pressure forces families into placements they later regret — without enough time to check inspection records or ask the right questions.",
    accent: "#fc8181",
    accentBg: "#fff5f5",
  },
  {
    icon: "💰",
    title: "Free services aren't free",
    body: "Referral platforms earn $3,000–$7,000 per placement from facilities. The facilities with the most referrals aren't the best ones — they're the ones paying the most.",
    accent: "#b7791f",
    accentBg: "#fffbeb",
  },
  {
    icon: "🔍",
    title: "Inspection data exists. No one explains it.",
    body: "Government inspection records are public. But 330 rows of deficiency codes mean nothing to a family in crisis. Someone needs to translate them.",
    accent: "#2c7a7b",
    accentBg: "#e6fffa",
  },
];

export default function ProblemSection() {
  return (
    <section className="bg-white py-20 lg:py-28 px-6 lg:px-16">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left */}
          <div>
            <p className="text-[11px] font-bold tracking-[3px] uppercase text-teal mb-4">
              The Problem
            </p>
            <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.25rem)] leading-[1.2] tracking-[-0.5px] text-navy mb-6">
              The information you need doesn&apos;t exist in one place.
            </h2>
            <div className="space-y-4 text-base leading-[1.7] text-slate max-w-[480px]">
              <p>
                When someone you love needs memory care, you face a choice no one
                is prepared to make. Tours are staged. Ratings are snapshots. Free
                referral services are paid by facilities, not you. And the clock is
                almost always ticking.
              </p>
              <p>
                Families describe being told: &ldquo;If you don&apos;t decide today, the
                hospital will choose for you.&rdquo; That&apos;s not a choice — that&apos;s
                pressure.
              </p>
            </div>
          </div>

          {/* Right — pain point cards */}
          <div className="space-y-4">
            {painPoints.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-xl border border-sc-border p-5 flex gap-4 hover:-translate-y-1 transition-transform duration-200"
                style={{
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
                  borderLeft: `4px solid ${card.accent}`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: card.accentBg }}
                >
                  {card.icon}
                </div>
                <div>
                  <p className="font-semibold text-navy text-[15px] mb-1">{card.title}</p>
                  <p className="text-sm leading-[1.7] text-slate">{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
