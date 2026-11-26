import type { PreviousLicense } from "@/lib/facility/previousLicense";

export function PreviousLicenseNote({ licenses }: { licenses: PreviousLicense[] }) {
  if (licenses.length === 0) return null;

  return (
    <aside className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-4">
      <div className="rounded-[16px] border border-clearing-rule-2 bg-paper-2 px-5 py-4">
        <p className="m-0 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          Previous license at this address
        </p>
        <ul className="mt-2 m-0 list-none p-0">
          {licenses.map((row) => (
            <li key={`${row.licenseNumber ?? row.name}`} className="text-[15px] leading-relaxed text-ink-2">
              {row.href ? (
                <a href={row.href} className="text-teal underline underline-offset-4">
                  {row.name}
                </a>
              ) : (
                <span className="font-medium text-ink">{row.name}</span>
              )}
              {row.licenseNumber ? (
                <span className="font-[family-name:var(--font-mono)] text-[13px] text-ink-3">
                  {" "}
                  · license {row.licenseNumber}
                </span>
              ) : null}
              {row.licenseStatus ? (
                <span className="text-ink-3"> · {row.licenseStatus.toLowerCase()}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 mb-0 font-[family-name:var(--font-sans)] text-[13px] text-ink-3">
          This is a separate license record, not merged with the current home.
        </p>
      </div>
    </aside>
  );
}
