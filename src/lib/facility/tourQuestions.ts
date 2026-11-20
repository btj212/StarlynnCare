/**
 * Stored tour questions were written once, with the citation count at that
 * time baked into the sentence ("The facility has 6 serious citations on file").
 * The count on the profile moves with each ingest, so the stored number drifted
 * from the rest of the page. Swap in the live count, and drop the question when
 * the live count is zero.
 */
export function freshenTourQuestions(
  questions: string[],
  live: { serious: number; deficiencies: number },
): string[] {
  const out: string[] = [];
  for (const question of questions) {
    const serious = question.match(/\b\d+ serious citations?\b/);
    const deficiencies = question.match(/\b\d+ deficienc(?:y|ies)\b/);
    const kind = serious ? "serious" : deficiencies ? "deficiencies" : null;
    if (!kind) {
      out.push(question);
      continue;
    }
    const n = kind === "serious" ? live.serious : live.deficiencies;
    if (n === 0) continue;
    const noun =
      kind === "serious"
        ? `${n} serious citation${n === 1 ? "" : "s"}`
        : `${n} deficienc${n === 1 ? "y" : "ies"}`;
    out.push(
      question
        .replace(kind === "serious" ? /\b\d+ serious citations?\b/ : /\b\d+ deficienc(?:y|ies)\b/, noun)
        .replace(/\b(?:each|the) cited items?\b/, n === 1 ? "the cited item" : "each cited item"),
    );
  }
  return out;
}
