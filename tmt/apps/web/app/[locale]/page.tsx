import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/SiteHeader";
import { isAppLocale, locales } from "../../i18n/routing";
import { canonicalFor } from "../../lib/seo";

type PageParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = isAppLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: safeLocale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: canonicalFor(`/${safeLocale}`),
      languages: Object.fromEntries(
        locales.map((item) => [item, canonicalFor(`/${item}`)]),
      ),
    },
  };
}

const categoryKeys = [
  "towing",
  "mechanic",
  "tires",
  "roadside",
  "diagnostics",
  "mobileRepair",
] as const;

const stepKeys = ["call", "explain", "connect"] as const;

export default async function LandingPage({
  params,
}: {
  params: PageParams;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    return null;
  }
  setRequestLocale(locale);
  const t = await getTranslations();
  const publicPhone = process.env.TWILIO_NUMBER_GENERAL?.trim();

  return (
    <>
      <SiteHeader locale={locale} />
      <main>
        <section className="relative overflow-hidden bg-[var(--tmt-navy)] text-white">
          <div
            aria-hidden="true"
            className="absolute -right-20 top-0 h-full w-56 rotate-12 bg-[var(--tmt-orange)] opacity-90 sm:w-80"
          />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.25fr_0.75fr] lg:py-32">
            <div>
              <p className="mb-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--tmt-orange)]">
                {t("landing.eyebrow")}
              </p>
              <h1 className="font-display max-w-4xl text-5xl font-black uppercase leading-[0.92] sm:text-7xl lg:text-8xl">
                {t("landing.heading")}
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
                {t("landing.body")}
              </p>
            </div>
            <div className="flex items-end">
              <div className="w-full border-l-4 border-[var(--tmt-orange)] bg-white p-6 text-[var(--tmt-navy)] shadow-2xl sm:p-8">
                <p className="text-sm font-black uppercase tracking-[0.18em]">
                  {t("landing.callLabel")}
                </p>
                {publicPhone ? (
                  <a
                    href={`tel:${publicPhone}`}
                    className="font-display mt-4 flex min-h-16 items-center text-4xl font-black text-[var(--tmt-navy)] underline decoration-[var(--tmt-orange)] decoration-4 underline-offset-8 sm:text-5xl"
                  >
                    {publicPhone}
                  </a>
                ) : (
                  <p className="mt-4 text-lg font-bold leading-7">
                    {t("landing.lineUnavailable")}
                  </p>
                )}
                <a
                  href={`/${locale}/login`}
                  className="mt-7 flex min-h-12 w-full items-center justify-center bg-[var(--tmt-orange)] px-5 py-3 text-center font-black uppercase tracking-wide text-[var(--tmt-navy)] transition hover:bg-orange-300"
                >
                  {t("landing.opsLink")}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <h2 className="font-display max-w-3xl text-4xl font-black uppercase leading-none sm:text-5xl">
            {t("landing.categoriesTitle")}
          </h2>
          <ul className="mt-9 grid gap-px overflow-hidden border border-[var(--tmt-navy)] bg-[var(--tmt-navy)] sm:grid-cols-2 lg:grid-cols-3">
            {categoryKeys.map((key, index) => (
              <li
                key={key}
                className="flex min-h-28 items-center gap-4 bg-white p-6"
              >
                <span className="font-display text-3xl font-black text-[var(--tmt-orange)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-xl font-black uppercase">
                  {t(`landing.categories.${key}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
            <h2 className="font-display text-4xl font-black uppercase sm:text-5xl">
              {t("landing.howTitle")}
            </h2>
            <ol className="mt-9 grid gap-7 md:grid-cols-3">
              {stepKeys.map((key, index) => (
                <li
                  key={key}
                  className="border-t-4 border-[var(--tmt-orange)] pt-5"
                >
                  <p className="font-display text-5xl font-black text-slate-300">
                    {index + 1}
                  </p>
                  <h3 className="mt-3 text-2xl font-black uppercase">
                    {t(`landing.steps.${key}.title`)}
                  </h3>
                  <p className="mt-3 leading-7 text-[var(--tmt-muted)]">
                    {t(`landing.steps.${key}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <footer className="bg-[var(--tmt-orange)] px-5 py-9 text-[var(--tmt-navy)] sm:px-8">
          <p className="mx-auto max-w-5xl text-center text-base font-black leading-7 sm:text-lg">
            {t("landing.privacy")}
          </p>
        </footer>
      </main>
    </>
  );
}
