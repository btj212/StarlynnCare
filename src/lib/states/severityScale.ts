import { CMS_IJ_LABEL, cmsScopeLetter, isCmsFTag, isCmsImmediateJeopardy } from "@/lib/states/cmsImmediateJeopardy";

/**
 * True when this profile may name a severity scale the regulator publishes.
 * Personal-care Pennsylvania and Arizona do not. Pennsylvania nursing homes
 * and other CMS grids pass scope "cms". A stored integer is not a scale.
 */
export function regulatorPublishesSeverityScale(
  stateCode: string,
  scope?: "cms" | "cdphe" | null,
): boolean {
  if (scope === "cms" || scope === "cdphe") return true;
  return ["CA", "IL", "OR", "CO", "MN", "UT", "WA", "MO"].includes(stateCode.toUpperCase());
}

export type ScaleFinding = {
  class?: string | null;
  code?: string | null;
  severity?: number | null;
  immediate_jeopardy?: boolean | null;
  state_severity_raw?: string | null;
  scope_severity_code?: string | null;
};

function letterOf(d: ScaleFinding): string | null {
  return cmsScopeLetter(d);
}

function rawText(d: ScaleFinding): string {
  return (d.state_severity_raw ?? "").trim();
}

/** Minnesota's SS letter (144G.31), from the scope column or "SS=J". */
function mnLetter(d: ScaleFinding): string | null {
  const direct = letterOf(d);
  if (direct) return direct;
  const match = /^SS\s*=\s*([A-L])$/i.exec(rawText(d).replace(/\s/g, ""));
  return match ? match[1].toUpperCase() : null;
}

function moClass(d: ScaleFinding): "I" | "II" | "III" | null {
  const text = (d.class ?? "").trim();
  const match = /^class\s+(i{1,3}|[123])$/i.exec(text);
  if (!match) return null;
  const token = match[1].toUpperCase();
  if (token === "1" || token === "I") return "I";
  if (token === "2" || token === "II") return "II";
  if (token === "3" || token === "III") return "III";
  return null;
}

/**
 * A citation carries the state's own scale value, not a placeholder we stored.
 * Oregon's "OR-cited" text does not. Pennsylvania personal-care integers do not.
 */
export function citationCarriesScaleValue(
  stateCode: string,
  d: ScaleFinding,
  scope?: "cms" | "cdphe" | null,
): boolean {
  const code = stateCode.toUpperCase();
  if (scope === "cms") return letterOf(d) != null;
  if (scope === "cdphe") return /^[A-E]$/i.test((d.class ?? "").trim());
  if (code === "CA") return d.class === "Type A" || d.class === "Type B";
  if (code === "IL") {
    return d.severity != null || /^type\s*[123]$/i.test(rawText(d));
  }
  if (code === "OR") {
    return (
      (d.severity != null && d.severity >= 1 && d.severity <= 4) ||
      /^level\s*[1-4]$/i.test(rawText(d))
    );
  }
  if (code === "CO") return /^[A-E]$/i.test((d.class ?? "").trim());
  if (code === "MN") return mnLetter(d) != null || d.severity != null;
  if (code === "UT") {
    return letterOf(d) != null || /^(low|moderate|high|extreme)$/i.test(rawText(d));
  }
  if (code === "WA") return /^(type\s*[abc]|ij|immediate jeopardy)$/i.test(rawText(d));
  if (code === "MO") return moClass(d) != null;
  return false;
}

/** The top tier, in the regulator's words. Null when this row is not that tier. */
export function topTierLabel(
  stateCode: string,
  d: ScaleFinding,
  scope?: "cms" | "cdphe" | null,
): { label: string; tone: "danger" } | null {
  const code = stateCode.toUpperCase();
  if (code === "CA") {
    return d.class === "Type A" ? { label: "Type A", tone: "danger" } : null;
  }
  if (scope === "cms" || (letterOf(d) && isCmsFTag(d.code) && "JKL".includes(letterOf(d) ?? ""))) {
    if (isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
    return null;
  }
  if (code === "IL") {
    const raw = rawText(d).toLowerCase();
    if ((d.severity != null && d.severity >= 3) || raw === "type 1" || raw === "t1") {
      return { label: "Type 1", tone: "danger" };
    }
    return null;
  }
  if (code === "OR") {
    const raw = rawText(d).toLowerCase();
    if ((d.severity != null && d.severity >= 4) || raw === "level 4") {
      return { label: "Level 4", tone: "danger" };
    }
    return null;
  }
  if (code === "CO" || scope === "cdphe") {
    if ((d.class ?? "").trim().toUpperCase() === "E") return { label: "Level E", tone: "danger" };
    return null;
  }
  if (code === "MN") {
    // Level 3 is SS G–I. Level 4 is SS J–L. The homes that showed a severe
    // finding had Level 3, so both levels keep that line, in Minnesota's letters.
    const letter = mnLetter(d);
    if (letter && "GHIJKL".includes(letter)) return { label: `SS ${letter}`, tone: "danger" };
    if (d.severity === 4) return { label: "Level 4", tone: "danger" };
    if (d.severity === 3) return { label: "Level 3", tone: "danger" };
    return null;
  }
  if (code === "UT") {
    const raw = rawText(d);
    if (/^(high|extreme)$/i.test(raw)) {
      return { label: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(), tone: "danger" };
    }
    if (isCmsImmediateJeopardy(d)) return { label: CMS_IJ_LABEL, tone: "danger" };
    return null;
  }
  if (code === "WA") {
    const raw = rawText(d);
    if (/^type\s*a$/i.test(raw)) return { label: "Type A", tone: "danger" };
    if (/^(ij|immediate jeopardy)$/i.test(raw)) return { label: "IJ", tone: "danger" };
    return null;
  }
  if (code === "MO") {
    return moClass(d) === "I" ? { label: "Class I", tone: "danger" } : null;
  }
  return null;
}

export function seriousTermWhenNone(stateCode: string, scope?: "cms" | "cdphe" | null): string {
  if (scope === "cms") return "CMS J, K, or L";
  if (scope === "cdphe" || stateCode.toUpperCase() === "CO") return "Level E";
  switch (stateCode.toUpperCase()) {
    case "CA":
      return "Type A";
    case "IL":
      return "Type 1";
    case "OR":
      return "Level 4";
    case "MN":
      return "Level 3 or Level 4";
    case "UT":
      return "High or Extreme";
    case "WA":
      return "Type A";
    case "MO":
      return "Class I";
    default:
      return "a serious finding";
  }
}
