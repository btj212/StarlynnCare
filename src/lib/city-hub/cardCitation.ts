/**
 * Card citation line. The all-years total always shows. A serious count is a
 * separate badge and never replaces the total. The A–Z list uses the same total.
 */
export function cardCitationLines(home: {
  inspections: number;
  total_citations: number;
  serious_citations: number;
}): { primary: string; seriousBadge: string | null } {
  if (home.inspections === 0) {
    return { primary: "No inspections on file yet", seriousBadge: null };
  }
  if (home.total_citations <= 0) {
    return { primary: "No citations on file (all years)", seriousBadge: null };
  }
  const total = home.total_citations;
  const serious = home.serious_citations;
  return {
    primary: `${total} citation${total === 1 ? "" : "s"} on file (all years)`,
    seriousBadge: serious > 0 ? `${serious} serious` : null,
  };
}
