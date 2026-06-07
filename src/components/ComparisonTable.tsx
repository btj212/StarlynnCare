type Cell = { text: string; type?: "check" | "cross" | "text" };

const rows: { label: string; sc: Cell; apfm: Cell; medicare: Cell }[] = [
  {
    label: "Revenue model",
    sc: { text: "Family subscriptions", type: "text" },
    apfm: { text: "Facility referral fees", type: "text" },
    medicare: { text: "Government (free)", type: "text" },
  },
  {
    label: "Memory care ALF data",
    sc: { text: "State inspection records", type: "check" },
    apfm: { text: "Not shown", type: "cross" },
    medicare: { text: "ALFs not covered", type: "cross" },
  },
  {
    label: "Inspector narratives",
    sc: { text: "Actual written findings", type: "check" },
    apfm: { text: "", type: "cross" },
    medicare: { text: "", type: "cross" },
  },
  {
    label: "Conflict of interest",
    sc: { text: "None", type: "check" },
    apfm: { text: "Facilities pay per referral", type: "cross" },
    medicare: { text: "None", type: "text" },
  },
  {
    label: "Covers memory care",
    sc: { text: "Primary focus", type: "check" },
    apfm: { text: "Partial", type: "text" },
    medicare: { text: "Nursing homes only", type: "cross" },
  },
  {
    label: "Cost to families",
    sc: { text: "Low subscription", type: "check" },
    apfm: { text: "Free (facilities pay)", type: "text" },
    medicare: { text: "Free", type: "text" },
  },
];

function CellValue({ cell }: { cell: Cell }) {
  if (cell.type === "check") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-green font-bold">✓</span>
        <span className="text-slate text-sm">{cell.text}</span>
      </span>
    );
  }
  if (cell.type === "cross") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-red-badge font-bold">✕</span>
        <span className="text-slate text-sm">{cell.text}</span>
      </span>
    );
  }
  return <span className="text-slate text-sm">{cell.text}</span>;
}

export default function ComparisonTable() {
  return (
    <section className="bg-navy py-20 lg:py-28 px-6 lg:px-16">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold tracking-[3px] uppercase text-teal-mid mb-4">
            Why StarlynnCare
          </p>
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.25rem)] leading-[1.2] tracking-[-0.5px] text-white mb-4">
            Built for families. Not for facilities.
          </h2>
          <p className="text-white/65 text-base max-w-[540px] mx-auto leading-[1.7]">
            Every platform you&apos;ve found so far earns money when you choose a
            facility. We don&apos;t. Here&apos;s what that means in practice.
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl overflow-hidden border border-white/10">
          {/* Header */}
          <div className="grid grid-cols-4 bg-navy border-b border-sc-border">
            <div className="p-4 col-span-1" />
            <div className="p-4 border-l-2 border-teal bg-teal-light/10">
              <p className="font-semibold text-teal text-sm">StarlynnCare</p>
            </div>
            <div className="p-4 border-l border-sc-border">
              <p className="font-medium text-white/60 text-sm">A Place for Mom</p>
            </div>
            <div className="p-4 border-l border-sc-border">
              <p className="font-medium text-white/60 text-sm">Care Compare</p>
              <p className="text-white/40 text-xs">(Medicare)</p>
            </div>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-4 border-b border-sc-border last:border-0 ${
                i % 2 === 0 ? "bg-white" : "bg-warm-white/60"
              }`}
            >
              <div className="p-4 text-[13px] font-medium text-navy">{row.label}</div>
              <div className="p-4 border-l-2 border-teal bg-teal-light/20">
                <CellValue cell={row.sc} />
              </div>
              <div className="p-4 border-l border-sc-border">
                <CellValue cell={row.apfm} />
              </div>
              <div className="p-4 border-l border-sc-border">
                <CellValue cell={row.medicare} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
