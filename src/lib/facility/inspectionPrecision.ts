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

export type ProfileVisit = {
  date: string;
  type: string | null;
  isComplaint: boolean;
  precision: DatePrecision;
};

export type ProfileComplaint = {
  date: string;
  precision: DatePrecision;
};

type VisitRow = {
  inspection_date: string;
  inspection_type: string | null;
  is_complaint: boolean;
  datePrecision: DatePrecision;
};

function newerByDate<T extends { date: string }>(current: T | null, next: T | null): T | null {
  if (!current) return next;
  if (!next) return current;
  return next.date > current.date ? next : current;
}

/**
 * `latestVisit` is unchanged: the newest visit of any kind, including a
 * complaint and the posted-PDF fallback.
 * Washington `latestInspection` is an inspection only. A complaint
 * investigation is `latestComplaint`. Other states copy `latestVisit` and
 * leave the complaint null, so their pages stay the same.
 * Inspections must be newest-first.
 */
export function resolveProfileVisits(input: {
  stateCode: string;
  inspections: VisitRow[];
  waPostedReport: { posted_month: string; doc_type: string } | null;
  derivedLastInspection: string | null;
}): {
  latestVisit: ProfileVisit | null;
  latestInspection: ProfileVisit | null;
  latestComplaint: ProfileComplaint | null;
} {
  const pdfDay = postedMonthToIsoDay(input.waPostedReport?.posted_month);
  const rowVisit = input.inspections[0];
  const pdfIsNewest = pdfDay != null && (!rowVisit || pdfDay > rowVisit.inspection_date);
  const latestVisit: ProfileVisit | null =
    pdfIsNewest && pdfDay && input.waPostedReport
      ? {
          date: pdfDay,
          type: input.waPostedReport.doc_type === "investigation" ? "complaint" : "standard",
          isComplaint: input.waPostedReport.doc_type === "investigation",
          precision: "month",
        }
      : rowVisit
        ? {
            date: rowVisit.inspection_date,
            type: rowVisit.inspection_type,
            isComplaint: rowVisit.is_complaint,
            precision: rowVisit.datePrecision,
          }
        : input.derivedLastInspection
          ? {
              date: input.derivedLastInspection,
              type: null,
              isComplaint: false,
              precision: pdfDay === input.derivedLastInspection ? "month" : "day",
            }
          : null;

  if (input.stateCode.toUpperCase() !== "WA") {
    return { latestVisit, latestInspection: latestVisit, latestComplaint: null };
  }

  const newestInspection = input.inspections.find((row) => row.is_complaint === false) ?? null;
  const newestComplaint = input.inspections.find((row) => row.is_complaint === true) ?? null;
  const inspectionFromRow: ProfileVisit | null = newestInspection
    ? {
        date: newestInspection.inspection_date,
        type: newestInspection.inspection_type,
        isComplaint: false,
        precision: newestInspection.datePrecision,
      }
    : null;
  const inspectionFromPdf: ProfileVisit | null =
    input.waPostedReport?.doc_type === "inspection" && pdfDay
      ? { date: pdfDay, type: "standard", isComplaint: false, precision: "month" }
      : null;
  const complaintFromRow: ProfileComplaint | null = newestComplaint
    ? { date: newestComplaint.inspection_date, precision: newestComplaint.datePrecision }
    : null;
  const complaintFromPdf: ProfileComplaint | null =
    input.waPostedReport?.doc_type === "investigation" && pdfDay
      ? { date: pdfDay, precision: "month" }
      : null;

  return {
    latestVisit,
    latestInspection: newerByDate(inspectionFromRow, inspectionFromPdf),
    latestComplaint: newerByDate(complaintFromRow, complaintFromPdf),
  };
}
