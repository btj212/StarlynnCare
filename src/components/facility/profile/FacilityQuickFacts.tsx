import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { formatFacilityName } from "@/lib/facility/displayName";
import { missingPhoneRecordLabel, parsePhone } from "@/lib/facility/phone";
import { formatRecordDate } from "@/lib/format/formatRecordDate";
import { regulatorLicensePageFor } from "@/lib/seo/schema";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatRecordDate(iso, "month");
}

function QfCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-clearing-rule-2 bg-clearing-card px-4 py-4 shadow-[var(--shadow-card)] md:px-5 md:py-5">
      <div className="mb-1.5 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
        {label}
      </div>
      <div className="font-[family-name:var(--font-display)] text-[28px] leading-[1.05] tracking-[-0.005em] text-ink">
        {children}
      </div>
    </div>
  );
}

export function FacilityQuickFacts({ profile }: { profile: FacilityProfile }) {
  const { facility, totals } = profile;
  const isWa = facility.state_code === "WA";
  const inspection = profile.latestInspection;
  const lastInspLabel = inspection
    ? formatRecordDate(inspection.date, inspection.precision)
    : isWa
      ? "Not on file"
      : fmt(facility.last_inspection_date);
  const complaintLabel =
    isWa && profile.latestComplaint
      ? formatRecordDate(profile.latestComplaint.date, profile.latestComplaint.precision)
      : null;
  const phone = parsePhone(facility.phone);
  const phoneRecordUrl = phone
    ? null
    : regulatorLicensePageFor(facility.state_code, facility.license_number);
  const phoneRecordLabel = phone ? null : missingPhoneRecordLabel(facility.state_code);

  return (
    <div className="border-y border-clearing-rule bg-clearing-tint">
      <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 md:px-[60px]">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          <QfCell label={facility.co_care_setting === "NH" ? "Certified beds" : "Licensed beds"}>
            {facility.beds ?? "—"}
          </QfCell>
          <QfCell label="Last inspection">
            <span className="text-[22px]">{lastInspLabel ?? "—"}</span>
            {complaintLabel ? (
              <span className="mt-1 block font-[family-name:var(--font-sans)] text-[12px] font-medium leading-snug text-ink-3">
                Last complaint investigation {complaintLabel}
              </span>
            ) : null}
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
                href={`tel:${phone.tel}`}
                className="font-[family-name:var(--font-sans)] text-[15px] font-medium leading-snug text-teal underline-offset-2 hover:underline"
              >
                {phone.display}
              </a>
            ) : (
              <span className="flex flex-col gap-1">
                <span className="font-[family-name:var(--font-sans)] text-[15px] text-ink-3">Not on file</span>
                {phoneRecordUrl && phoneRecordLabel ? (
                  <a
                    href={phoneRecordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-[family-name:var(--font-sans)] text-[12px] font-medium leading-snug text-teal underline underline-offset-2"
                  >
                    {phoneRecordLabel}
                  </a>
                ) : null}
              </span>
            )}
          </QfCell>
        </div>
      </div>
    </div>
  );
}
