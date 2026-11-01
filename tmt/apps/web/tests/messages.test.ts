import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import hi from "../messages/hi.json";
import pa from "../messages/pa.json";

function flattenMessages(
  value: Record<string, unknown>,
  prefix = "",
): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === "string") {
      entries.set(path, nested);
    } else if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const [nestedKey, nestedValue] of flattenMessages(
        nested as Record<string, unknown>,
        path,
      )) {
        entries.set(nestedKey, nestedValue);
      }
    }
  }
  return entries;
}

describe("locale dictionaries", () => {
  const dictionaries = { en, pa, hi, es };
  const englishKeys = [...flattenMessages(en).keys()].sort();

  it.each(Object.entries(dictionaries))(
    "%s contains every message key with non-empty copy",
    (_locale, dictionary) => {
      const flattened = flattenMessages(dictionary);
      expect([...flattened.keys()].sort()).toEqual(englishKeys);
      expect([...flattened.values()].every((value) => value.trim().length > 0))
        .toBe(true);
    },
  );
});
