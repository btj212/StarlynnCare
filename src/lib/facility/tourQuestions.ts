/**
 * Stored tour questions were written once. A date, a count, or a zero/none
 * claim in that text goes stale. Drop those sentences at render time and
 * fill from the live profile until three questions are ready to show.
 */

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const NUMBER_WORDS =
  "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";

export type TourQuestionLive = {
  agencyShort: string;
  stateCode: string;
  lastVisitLabel: string | null;
  lastVisitIsComplaint: boolean;
  complaintsInWindow: number;
  windowCitations: number;
  basisRecorded: boolean;
};

/** True when a stored question states a date, a count, or a zero/none claim. */
export function storedTourQuestionDropped(question: string): boolean {
  const text = question.trim();
  if (!text) return true;
  if (new RegExp(`\\b(?:${MONTHS})\\s+\\d`, "i").test(text)) return true;
  if (new RegExp(`\\b(?:last|latest|most recent|recent)\\s+(?:${MONTHS})\\b`, "i").test(text)) return true;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(text)) return true;
  if (new RegExp(`\\b(?:${NUMBER_WORDS})\\b`, "i").test(text)) return true;
  if (/\d/.test(text)) return true;
  if (/\bnone\b/i.test(text)) return true;
  if (
    /\bno\s+(?:serious\s+|substantiated\s+|unsubstantiated\s+)?(?:citations?|deficiencies|deficiency|complaints?|findings?)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

function liveReplacements(live: TourQuestionLive): string[] {
  const agency = live.agencyShort.trim() || "The state agency";
  const pool: string[] = [];
  if (live.lastVisitLabel) {
    const kind = live.lastVisitIsComplaint ? "a complaint investigation" : "an inspection";
    pool.push(
      `${agency}'s most recent visit on file was ${live.lastVisitLabel} (${kind}). Can you share that report?`,
    );
  }
  if (live.complaintsInWindow > 0) {
    const n = live.complaintsInWindow;
    pool.push(
      `${agency} lists ${n} complaint investigation${n === 1 ? "" : "s"} in the last 3 years. What changed after them?`,
    );
  }
  if (live.windowCitations > 0) {
    const n = live.windowCitations;
    pool.push(
      `${agency} lists ${n} citation${n === 1 ? "" : "s"} in the last 3 years. What corrective action followed them?`,
    );
  }
  if (live.basisRecorded && live.stateCode.toUpperCase() === "CA") {
    pool.push(
      "Does the home hold a written dementia-care program under Title 22 section 87705, and can you share it?",
    );
  } else {
    pool.push("Does the home hold a written dementia-care program, and can you share it?");
  }
  pool.push("How does the home record a family complaint, and what changed after the last one it logged?");
  pool.push(`Can you walk through the latest ${agency} report with a family before a move-in?`);
  return pool;
}

/**
 * Drop stored questions that state a date, a count, or a zero/none claim.
 * Fill from live profile fields until three questions are ready.
 */
export function freshenTourQuestions(questions: string[], live: TourQuestionLive): string[] {
  const kept = questions.map((q) => q.trim()).filter((q) => q && !storedTourQuestionDropped(q));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const question of [...liveReplacements(live), ...kept]) {
    if (seen.has(question)) continue;
    seen.add(question);
    out.push(question);
    if (out.length >= 3) break;
  }
  return out;
}
