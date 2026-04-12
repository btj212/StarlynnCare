const columns = [
  {
    title: "Product",
    links: [
      { label: "How It Works", href: "#how-it-works" },
      { label: "Facility Profiles", href: "#sample-card" },
      { label: "For Families", href: "#two-path" },
      { label: "Pricing (coming soon)", href: "#" },
    ],
  },
  {
    title: "Data",
    links: [
      { label: "About Our Data", href: "#" },
      { label: "AHCA Inspection Records", href: "#" },
      { label: "CMS Nursing Home Data", href: "#" },
      { label: "Data Freshness", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "No Commissions Policy", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: "#0f2235" }}>
      <div className="max-w-[1100px] mx-auto px-6 lg:px-16 pt-16 pb-10">
        {/* Top grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="inline-flex flex-col mb-3">
              <span className="font-serif text-xl font-semibold">
                <span className="text-white">Starlynn</span>
                <span className="text-teal">Care</span>
              </span>
            </a>
            <p className="text-[13px] text-white/50 leading-relaxed mb-4">
              Memory care, honestly.
            </p>
            <p className="text-[12px] text-white/30">
              © 2026 StarlynnCare
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/40 mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-white/50 hover:text-white/80 transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6">
          <p className="text-[12px] text-white/30 leading-relaxed">
            Data sourced from Florida AHCA public inspection records and CMS Care
            Compare. StarlynnCare is not affiliated with any care facility or
            referral service.
          </p>
        </div>
      </div>
    </footer>
  );
}
