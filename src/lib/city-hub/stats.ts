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
  seriousLast12: number;
  homesWithSeriousLast12: number;
  newestInspection: string | null;
  size: CitySizeSplit;
  sdcCount: number;
  pchCount: number;
  alrCount: number;
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
  beds: number | null;
  zip: string | null;
  total_citations: number;
  wa_dementia_care_contract?: boolean | null;
  wa_earc_sdc_contracted?: boolean | null;
  license_type?: string | null;
};

function monthsAgoIso(months: number, today = todayIsoDate()): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCMonth(dt.getUTCMonth() - months);
  return dt.toISOString().slice(0, 10);
}

export function isSeriousCityFinding(d: { class: string | null; severity: number | null }): boolean {
  return d.class === "Type A" || (d.severity ?? 0) >= 3;
}

export function computeCityHubGlance(input: {
  listed: GlanceHome[];
  publishableCount: number;
  inspections: CityInspectionRow[];
  deficiencies: CityDeficiencyRow[];
}): CityHubGlance {
  const listedIds = new Set(input.listed.map((h) => h.id));
  const listedCount = input.listed.length;
  const cutoff12 = monthsAgoIso(12);

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
  let seriousLast12 = 0;
  const homesSerious12 = new Set<string>();
  const inspFac = new Map(input.inspections.map((i) => [i.id, i.facility_id]));
  for (const d of input.deficiencies) {
    const date = inspDate.get(d.inspection_id);
    const fid = inspFac.get(d.inspection_id);
    if (!date || !fid || !listedIds.has(fid) || date < cutoff12) continue;
    citationsLast12 += 1;
    if (isSeriousCityFinding(d)) {
      seriousLast12 += 1;
      homesSerious12.add(fid);
    }
  }

  const withCitation = input.listed.filter((h) => h.total_citations > 0).length;
  const size: CitySizeSplit = { lte6: 0, from7to10: 0, gte11: 0 };
  const zips = new Set<string>();
  let bedsTotal = 0;
  let sdcCount = 0;
  let pchCount = 0;
  let alrCount = 0;
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
    seriousLast12,
    homesWithSeriousLast12: homesSerious12.size,
    newestInspection,
    size,
    sdcCount,
    pchCount,
    alrCount,
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
): RecentSeriousHome[] {
  const listedById = new Map(listed.map((h) => [h.id, h]));
  const cutoff12 = monthsAgoIso(12);
  const inspFac = new Map(inspections.map((i) => [i.id, i]));
  const seriousByFac = new Map<string, { date: string; count: number }>();

  for (const d of deficiencies) {
    if (!isSeriousCityFinding(d)) continue;
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
