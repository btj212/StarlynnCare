type Props = {
  /** ISO date string (yyyy-mm-dd or full ISO). Rendered as "Month YYYY". */
  isoDate: string;
};

/**
 * Visible "Last updated [Month YYYY]" stamp for hub and editorial pages.
 * Mirrors the convention on /methodology and /editorial-policy.
 * Add id prop when the stamp needs to be a Speakable target.
 */
export function UpdatedStamp({ isoDate }: Props) {
  const month = new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return (
    <p className="mt-3 text-[14px] font-[family-name:var(--font-mono)] text-muted">
      Last updated {month}
    </p>
  );
}
