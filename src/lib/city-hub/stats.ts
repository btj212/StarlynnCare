import { todayIsoDate } from "@/lib/data/inspectionDates";
import { isUsableInspectionDate } from "@/lib/data/inspectionDates";

export type CitySizeSplit = {
  lte6: number;
  from7to10: number;
  gte11: number;
};

export type CityHubGlance = {
  listedCount: number;
  publishableCount: number;
  excludedCount: number;
  bedsTotal: number;
  zipCount: number;
  withCitation: number;
  withCitationPct: number;
  inspectionsLast12: number;
  citationsLast12: number;
  citationsPrior12: number;
  citationsLast36: number;
  seriousLast12: number;
  homesWithSeriousLast12: number;
  typeALast12: number;
  homesWithTypeALast12: number;
  newestInspection: string | null;
  /** False when this state's stored findings have no class/severity we trust. */
  severityMeasured: boolean;
  size: CitySizeSplit;
  sdcCount: number;
  pchCount: number;
  alrCount: number;
  /** Minnesota ALDC licenses among listed homes. */
  dementiaLicenseCount: number;
  ccrcCount: number;
  topCitedLast12Name: string | null;
  topCitedLast12Count: number;
};

export type CityInspectionRow = {
  id: string;
  facility_id: string;
  inspection_date: string;
};

export type CityDeficiencyRow = {
  inspection_id: string;
  class: string | null;
  severity: number | null;
};

type GlanceHome = {
  id: string;
  name?: string;
  beds: number | null;
  zip: string | null;
  total_citations: number;
  care_category?: string | null;
  wa_dementia_care_contract?: boolean | null;
  wa_earc_sdc_contracted?: boolean | null;
  license_type?: string | null;
  mn_dementia_care_licensed?: boolean | null;
};

function monthsAgoIso(months: number, today = todayIsoDate()): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCMonth(dt.getUTCMonth() - months);
  return dt.toISOString().slice(0, 10);
}

function classLabel(raw: string | null): string {
  return (raw ?? "").trim().toUpperCase().replace(/^CLASS\s+/, "");
}

/**
 * "Serious" for city-hub stats and card badges.
 * Oregon: never — citations have no class or severity in our data.
 * Missouri: Class I only. Stored severity numbers are inverted (Class I as
 * severity 2, some Class III as 4) and are not used until that mapping is audited.
 * California and others: Type A class, or severity >= 3 when that is the ingest.
 */
export function isSeriousCityFinding(
  d: { class: string | null; severity: number | null },
  stateCode?: string,
): boolean {
  const code = (stateCode ?? "").toUpperCase();
  if (code === "OR") return false;
  if (code === "MO") {
    const cls = classLabel(d.class);
    return cls === "I" || cls === "1";
  }
  return d.class === "Type A" || (d.severity ?? 0) >= 3;
}

export function isTypeAFinding(d: { class: string | null }): boolean {
  return d.class === "Type A";
}

export function stateHasSeverityInData(
  deficiencies: Array<{ class: string | null; severity: number | null }>,
  stateCode: string,
): boolean {
  const code = stateCode.toUpperCase();
  if (code === "OR") return false;
  if (deficiencies.length === 0) return code !== "OR";
  return deficiencies.some((d) => (d.class != null && d.class.trim() !== "") || d.severity != null);
}

export function computeCityHubGlance(input: {
  listed: GlanceHome[];
  publishableCount: number;
  inspections: CityInspectionRow[];
  deficiencies: CityDeficiencyRow[];
  stateCode: string;
}): CityHubGlance {
  const listedIds = new Set(input.listed.map((h) => h.id));
  const listedById = new Map(input.listed.map((h) => [h.id, h]));
  const listedCount = input.listed.length;
  const cutoff12 = monthsAgoIso(12);
  const cutoff24 = monthsAgoIso(24);
  const cutoff36 = monthsAgoIso(36);
  const stateCode = input.stateCode;

  const inspDate = new Map<string, string>();
  let inspectionsLast12 = 0;
  let newestInspection: string | null = null;
  for (const row of input.inspections) {
    if (!listedIds.has(row.facility_id) || !isUsableInspectionDate(row.inspection_date)) continue;
    inspDate.set(row.id, row.inspection_date);
    if (row.inspection_date >= cutoff12) inspectionsLast12 += 1;
    if (!newestInspection || row.inspection_date > newestInspection) {
      newestInspection = row.inspection_date;
    }
  }

  let citationsLast12 = 0;
  let citationsPrior12 = 0;
  let citationsLast36 = 0;
  let seriousLast12 = 0;
  let typeALast12 = 0;
  const homesSerious12 = new Set<string>();
  const homesTypeA12 = new Set<string>();
  const citedLast12 = new Map<string, number>();
  const inspFac = new Map(input.inspections.map((i) => [i.id, i.facility_id]));
  for (const d of input.deficiencies) {
    const date = inspDate.get(d.inspection_id);
    const fid = inspFac.get(d.inspection_id);
    if (!date || !fid || !listedIds.has(fid)) continue;
    if (date >= cutoff36) citationsLast36 += 1;
    if (date >= cutoff12) {
      citationsLast12 += 1;
      citedLast12.set(fid, (citedLast12.get(fid) ?? 0) + 1);
      if (isSeriousCityFinding(d, stateCode)) {
        seriousLast12 += 1;
        homesSerious12.add(fid);
      }
      if (isTypeAFinding(d)) {
        typeALast12 += 1;
        homesTypeA12.add(fid);
      }
    } else if (date >= cutoff24) {
      citationsPrior12 += 1;
    }
  }

  let topCitedLast12Name: string | null = null;
  let topCitedLast12Count = 0;
  for (const [fid, n] of citedLast12) {
    if (n > topCitedLast12Count) {
      topCitedLast12Count = n;
      topCitedLast12Name = listedById.get(fid)?.name ?? null;
    }
  }

  const withCitation = input.listed.filter((h) => h.total_citations > 0).length;
  const size: CitySizeSplit = { lte6: 0, from7to10: 0, gte11: 0 };
  const zips = new Set<string>();
  let bedsTotal = 0;
  let sdcCount = 0;
  let pchCount = 0;
  let alrCount = 0;
  let dementiaLicenseCount = 0;
  let ccrcCount = 0;
  for (const h of input.listed) {
    const beds = h.beds;
    if (beds != null) {
      bedsTotal += beds;
      if (beds <= 6) size.lte6 += 1;
      else if (beds <= 10) size.from7to10 += 1;
      else size.gte11 += 1;
    }
    const zip = h.zip?.trim().slice(0, 5);
    if (zip) zips.add(zip);
    if (h.wa_dementia_care_contract || h.wa_earc_sdc_contracted) sdcCount += 1;
    const lt = (h.license_type ?? "").toUpperCase();
    if (lt.includes("PERSONAL CARE")) pchCount += 1;
    else if (lt.includes("ASSISTED LIVING")) alrCount += 1;
    if (h.mn_dementia_care_licensed) dementiaLicenseCount += 1;
    if (h.care_category === "ccrc" || lt.includes("CCRC")) ccrcCount += 1;
  }

  return {
    listedCount,
    publishableCount: input.publishableCount,
    excludedCount: Math.max(0, input.publishableCount - listedCount),
    bedsTotal,
    zipCount: zips.size,
    withCitation,
    withCitationPct: listedCount > 0 ? Math.round((withCitation / listedCount) * 100) : 0,
    inspectionsLast12,
    citationsLast12,
    citationsPrior12,
    citationsLast36,
    seriousLast12,
    homesWithSeriousLast12: homesSerious12.size,
    typeALast12,
    homesWithTypeALast12: homesTypeA12.size,
    newestInspection,
    severityMeasured: stateHasSeverityInData(input.deficiencies, stateCode),
    size,
    sdcCount,
    pchCount,
    alrCount,
    dementiaLicenseCount,
    ccrcCount,
    topCitedLast12Name,
    topCitedLast12Count,
  };
}

export type RecentSeriousHome = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  date: string;
  seriousCount: number;
};

export function recentSeriousHomes<
  T extends { id: string; name: string; slug: string; city_slug: string },
>(
  listed: T[],
  inspections: CityInspectionRow[],
  deficiencies: CityDeficiencyRow[],
  limit = 8,
  stateCode?: string,
): RecentSeriousHome[] {
  const listedById = new Map(listed.map((h) => [h.id, h]));
  const cutoff12 = monthsAgoIso(12);
  const inspFac = new Map(inspections.map((i) => [i.id, i]));
  const seriousByFac = new Map<string, { date: string; count: number }>();

  for (const d of deficiencies) {
    if (!isSeriousCityFinding(d, stateCode)) continue;
    const insp = inspFac.get(d.inspection_id);
    if (!insp || !listedById.has(insp.facility_id)) continue;
    if (!isUsableInspectionDate(insp.inspection_date) || insp.inspection_date < cutoff12) continue;
    const cur = seriousByFac.get(insp.facility_id);
    if (!cur) {
      seriousByFac.set(insp.facility_id, { date: insp.inspection_date, count: 1 });
    } else {
      cur.count += 1;
      if (insp.inspection_date > cur.date) cur.date = insp.inspection_date;
    }
  }

  return [...seriousByFac.entries()]
    .map(([id, v]) => {
      const h = listedById.get(id)!;
      return {
        id,
        name: h.name,
        slug: h.slug,
        city_slug: h.city_slug,
        date: v.date,
        seriousCount: v.count,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.seriousCount - a.seriousCount)
    .slice(0, limit);
}
