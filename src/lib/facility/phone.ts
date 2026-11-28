import { regulatorFor } from "@/lib/states/regulators";

export type ParsedPhone = {
  display: string;
  tel: string;
};

const DEEP_LINK_STATES = new Set(["CA", "OR"]);

/**
 * A public phone is a NANP number: 10 digits, or 11 with a leading 1.
 * The area code and the exchange cannot start with 0 or 1.
 * A trailing extension is kept on the display and left off the tel link.
 * Anything else is omitted. A short or impossible number must not be shown or linked.
 */
export function parsePhone(raw: string | null | undefined): ParsedPhone | null {
  if (!raw?.trim()) return null;
  const extension = raw.match(/(?:ext\.?|extension|x)\s*(\d+)\s*$/i);
  const withoutExtension = extension ? raw.slice(0, extension.index).trim() : raw.trim();
  if (withoutExtension.includes(",")) return null;
  const digits = withoutExtension.replace(/\D/g, "");
  const tenDigits =
    digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
  if (!tenDigits || !/^[2-9]\d{2}[2-9]\d{6}$/.test(tenDigits)) return null;
  const area = tenDigits.slice(0, 3);
  const prefix = tenDigits.slice(3, 6);
  const line = tenDigits.slice(6);
  const ext = extension ? ` ext. ${extension[1]}` : "";
  return { display: `(${area}) ${prefix}-${line}${ext}`, tel: tenDigits };
}

/**
 * Link under a missing phone. California and Oregon open that home's record.
 * Every other state opens the regulator's search directory, and the label says so.
 */
export function missingPhoneRecordLabel(stateCode: string): string | null {
  const regulator = regulatorFor(stateCode);
  if (!regulator) return null;
  const code = stateCode.toUpperCase();
  const name = code === "OR" ? regulator.cite : regulator.short;
  if (DEEP_LINK_STATES.has(code)) return `Check ${name} record`;
  return `Search the ${name} provider directory`;
}
