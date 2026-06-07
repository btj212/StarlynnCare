const steps = [
  {
    number: "01",
    icon: "📍",
    title: "Enter your location",
    body: "Tell us where you're looking and what timeline you're working with. Planning ahead or need placement this week — we adapt to your situation.",
  },
  {
    number: "02",
    icon: "📋",
    title: "See what inspectors found",
    body: "Every facility profile shows real state inspection records, deficiency classes, violation categories, and inspector findings — the actual written observations, not just a star rating.",
  },
  {
    number: "03",
    icon: "✓",
    title: "Make a decision you trust",
    body: "Compare facilities side-by-side. Generate a tour checklist. Set an alert if a facility's inspection status changes. Know what you're walking into before you tour.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-warm-white py-20 lg:py-28 px-6 lg:px-16">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-14">
          <p className="text-[11px] font-bold tracking-[3px] uppercase text-teal mb-4">
            How It Works
          </p>
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.25rem)] leading-[1.2] tracking-[-0.5px] text-navy">
            From search to confident decision in three steps.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Connecting line on desktop */}
          <div className="hidden md:block absolute top-12 left-[calc(33.33%+1.5rem)] right-[calc(33.33%+1.5rem)] h-px bg-sc-border" />
          <div className="hidden md:block absolute top-12 left-1/2 right-[calc(16.67%+1.5rem)] h-px bg-sc-border" />

          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white rounded-xl border border-sc-border p-6 hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[11px] font-bold tracking-[2px] text-muted font-mono">
                  {step.number}
                </span>
                <span className="text-2xl">{step.icon}</span>
              </div>
              <h3 className="font-semibold text-navy text-xl mb-3 leading-[1.3]">
                {step.title}
              </h3>
              <p className="text-sm leading-[1.7] text-slate">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
