/** Same bar as the "limited history" label on a city card: under 4 inspections in three years. */
export const LIMITED_HISTORY_MIN_INSPECTIONS = 4;

export function isLimitedInspectionHistory(inspectionsInThreeYears: number): boolean {
  return inspectionsInThreeYears < LIMITED_HISTORY_MIN_INSPECTIONS;
}

/** Top-ranked block. Homes the page would label "limited history" stay off it. */
export function keepTopRanked<T extends { id: string }>(
  rows: T[],
  inspectionsInThreeYears: ReadonlyMap<string, number>,
): T[] {
  return rows.filter(
    (row) => (inspectionsInThreeYears.get(row.id) ?? 0) >= LIMITED_HISTORY_MIN_INSPECTIONS,
  );
}
