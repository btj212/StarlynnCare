import type { Facility } from "@/lib/types";

interface QuickFactsProps {
  facility: Facility;
  lastInspectionDate?: string | null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "None on record";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function LicenseStatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  const lower = status.toLowerCase();
  const isActive = lower === "licensed" || lower === "active";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${
        isActive
          ? "bg-teal-light text-teal border border-teal/20"
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}
    >
      {status}
    </span>
  );
}

interface FactItemProps {
  label: string;
  value: React.ReactNode;
}

function FactItem({ label, value }: FactItemProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-sm font-medium text-ink leading-snug">{value}</span>
    </div>
  );
}

export function QuickFacts({ facility, lastInspectionDate }: QuickFactsProps) {
  const phone = facility.phone;
  const formattedPhone = phone
    ? phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3").replace(/\D+$/, "")
    : null;

  return (
    <div className="mt-8 rounded-xl border border-sc-border bg-white px-5 py-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-4">
        Quick facts
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap lg:gap-x-8 lg:gap-y-4">
        <FactItem
          label="Licensed beds"
          value={facility.beds != null ? String(facility.beds) : "—"}
        />
        <FactItem
          label="License status"
          value={
            facility.license_status ? (
              <LicenseStatusPill status={facility.license_status} />
            ) : (
              "—"
            )
          }
        />
        <FactItem
          label="Memory care"
          value={
            facility.serves_memory_care ? (
              <span className="inline-flex items-center gap-1 text-teal font-semibold text-sm">
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                Yes
              </span>
            ) : (
              <span className="text-muted text-sm">Not listed</span>
            )
          }
        />
        <FactItem
          label="Last inspection"
          value={formatDate(lastInspectionDate ?? facility.last_inspection_date)}
        />
        {facility.operator_name && (
          <FactItem label="Operated by" value={facility.operator_name} />
        )}
        {formattedPhone && (
          <FactItem
            label="Phone"
            value={
              <a
                href={`tel:${phone}`}
                className="text-teal hover:underline underline-offset-2"
              >
                {formattedPhone}
              </a>
            }
          />
        )}
      </div>
    </div>
  );
}
