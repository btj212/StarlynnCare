const stats = [
  { number: "694", label: "Florida nursing homes tracked" },
  { number: "418,972", label: "Federal inspection records" },
  { number: "$0", label: "Referral commissions charged" },
  { number: "26K", label: "Monthly searches, no good answer" },
  { number: "100%", label: "Independent — no facility partnerships" },
];

export default function StatBar() {
  return (
    <section className="bg-navy py-12 px-6 lg:px-16">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-0 md:divide-x divide-white/10">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={`text-center px-4 ${
                i === 4 ? "col-span-2 md:col-span-1" : ""
              }`}
            >
              <p className="text-[28px] font-bold text-white leading-tight">{stat.number}</p>
              <p className="text-[12px] text-white/60 mt-1 leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
