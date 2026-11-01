import { defineRouting } from "next-intl/routing";

export const locales = ["en", "pa", "hi", "es"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
});

export function isAppLocale(value: string): value is AppLocale {
  return locales.some((locale) => locale === value);
}
