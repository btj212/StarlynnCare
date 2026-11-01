import { getTranslations } from "next-intl/server";
import type { AppLocale } from "../i18n/routing";
import { locales } from "../i18n/routing";

export async function SiteHeader({
  locale,
  path = "",
}: {
  locale: AppLocale;
  path?: string;
}) {
  const t = await getTranslations();

  return (
    <header className="border-b border-[var(--tmt-line)] bg-[var(--tmt-cream)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <a
          href={`/${locale}`}
          className="flex min-h-12 items-center gap-3"
          aria-label={t("nav.home")}
        >
          <span className="font-display text-3xl font-black tracking-tight text-[var(--tmt-navy)]">
            {t("brand.mark")}
          </span>
          <span className="border-l-2 border-[var(--tmt-orange)] pl-3 text-sm font-bold uppercase tracking-[0.16em]">
            {t("brand.name")}
          </span>
        </a>
        <nav
          aria-label={t("nav.language")}
          className="flex flex-wrap items-center gap-1"
        >
          {locales.map((item) => (
            <a
              key={item}
              href={`/${item}${path}`}
              lang={item}
              aria-current={item === locale ? "page" : undefined}
              className="flex min-h-12 min-w-12 items-center justify-center rounded-full px-3 text-sm font-bold transition hover:bg-white aria-[current=page]:bg-[var(--tmt-navy)] aria-[current=page]:text-white"
            >
              {t(`languages.${item}`)}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
