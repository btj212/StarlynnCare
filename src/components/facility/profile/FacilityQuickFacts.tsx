import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { formatFacilityName } from "@/lib/facility/displayName";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const m = digits.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (!m) return raw;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

function QfCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-r border-paper-rule px-4 py-4 md:px-5 md:py-5 last:border-r-0">
      <div className="mb-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </div>
      <div className="font-[family-name:var(--font-display)] text-[28px] leading-[1.05] tracking-[-0.005em] text-ink">
        {children}
      </div>
    </div>
  );
}

export function FacilityQuickFacts({ profile }: { profile: FacilityProfile }) {
  const { facility, totals, inspections } = profile;
  const lastInspDate = inspections.find((i) => !i.is_complaint)?.inspection_date ?? null;
  const phone = formatPhone(facility.phone);

  return (
    <div className="border-y border-paper-rule bg-paper">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <QfCell label="Licensed beds">
            {facility.beds ?? "—"}
          </QfCell>
          <QfCell label="Last inspection">
            <span className="text-[22px]">{fmt(lastInspDate ?? facility.last_inspection_date)}</span>
          </QfCell>
          <QfCell label="Last citation">
            <span className="text-[22px]">{totals.lastCitation ? fmt(totals.lastCitation) : "None on record"}</span>
          </QfCell>
          <QfCell label="Operated by">
            <span className="font-[family-name:var(--font-sans)] text-[15px] font-medium leading-snug">
              {facility.operator_name
                ? formatFacilityName(facility.operator_name)
                : "—"}
            </span>
          </QfCell>
          <QfCell label="Phone">
            {phone ? (
              <a
                href={`tel:${facility.phone}`}
                className="font-[family-name:var(--font-sans)] text-[15px] font-medium leading-snug text-teal hover:underline underline-offset-2"
              >
                {phone}
              </a>
            ) : (
              <span className="font-[family-name:var(--font-sans)] text-[15px] text-ink-3">—</span>
            )}
          </QfCell>
        </div>
      </div>
    </div>
  );
}
