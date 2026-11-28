import { regulatorFor } from "@/lib/states/regulators";

export type ParsedPhone = {
  display: string;
  tel: string;
};

/**
 * A public phone is 10 digits, or 11 with a leading 1.
 * Anything else is omitted. A short number must not be shown or linked.
 */
export function parsePhone(raw: string | null | undefined): ParsedPhone | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  const tenDigits =
    digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
  if (!tenDigits) return null;
  const area = tenDigits.slice(0, 3);
  const prefix = tenDigits.slice(3, 6);
  const line = tenDigits.slice(6);
  return { display: `(${area}) ${prefix}-${line}`, tel: tenDigits };
}

/** Link under a missing phone. Oregon uses the cite "Oregon DHS", not the short code "OR DHS". */
export function missingPhoneRecordLabel(stateCode: string): string | null {
  const regulator = regulatorFor(stateCode);
  if (!regulator) return null;
  const name = stateCode.toUpperCase() === "OR" ? regulator.cite : regulator.short;
  return `Check ${name} record`;
}
