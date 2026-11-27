export type DatePrecision = "day" | "month";

/**
 * Format a stored ISO date without shifting the calendar day.
 * Month-only values (WA DSHS posted month stored as YYYY-MM-01) render as
 * "April 2026". Day-precision values render as "April 1, 2026".
 */
export function formatRecordDate(
  iso: string,
  precision: DatePrecision = "day",
): string {
  const day = iso.slice(0, 10);
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(day);
  if (!match) return day;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? "1")),
  );
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    ...(precision === "day" ? { day: "numeric" as const } : {}),
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Compact inspection-list label: "Apr 2026" or "Apr 1, 2026". */
export function formatInspectionListDate(
  iso: string,
  precision: DatePrecision = "day",
): string {
  const day = iso.slice(0, 10);
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(day);
  if (!match) return day;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? "1")),
  );
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    ...(precision === "day" ? { day: "numeric" as const } : {}),
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
