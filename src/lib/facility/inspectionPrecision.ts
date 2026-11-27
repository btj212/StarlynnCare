import type { DatePrecision } from "@/lib/format/formatRecordDate";

/**
 * WA DSHS Forms pages label reports with a month, not a day. Bundle ingest
 * and PDF backfill store that as YYYY-MM-01 with raw_data.washington and/or
 * raw_data.posted_month. A real visit day (PDF parse) has neither flag.
 */
export function inspectionDatePrecision(input: {
  inspection_date: string;
  raw_data?: {
    washington?: boolean;
    posted_month?: string;
  } | null;
}): DatePrecision {
  const raw = input.raw_data;
  if (raw?.posted_month) return "month";
  const day = input.inspection_date.slice(0, 10);
  if (raw?.washington === true && day.endsWith("-01")) return "month";
  return "day";
}

/** Turn a YYYY-MM posted month into a comparable ISO day (first of month). */
export function postedMonthToIsoDay(postedMonth: string | null | undefined): string | null {
  if (!postedMonth) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(postedMonth.trim());
  return match ? `${match[1]}-${match[2]}-01` : null;
}
