import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { SiteHeader } from "../../../components/SiteHeader";
import { isAppLocale } from "../../../i18n/routing";
import { canonicalFor } from "../../../lib/seo";
import { sendMagicLink } from "./actions";

type LoginParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: LoginParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = isAppLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: safeLocale, namespace: "login" });
  return {
    title: t("title"),
    alternates: { canonical: canonicalFor(`/${safeLocale}/login`) },
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: LoginParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    return null;
  }
  setRequestLocale(locale);
  const t = await getTranslations("login");
  const query = await searchParams;
  const sent = query.sent === "1";
  const hasError = typeof query.error === "string";

  return (
    <>
      <SiteHeader locale={locale} path="/login" />
      <main className="mx-auto grid min-h-[calc(100vh-81px)] max-w-7xl items-stretch lg:grid-cols-2">
        <section className="flex items-center bg-[var(--tmt-navy)] px-5 py-14 text-white sm:px-10 lg:px-16">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--tmt-orange)]">
              TMT OPS
            </p>
            <h1 className="font-display mt-5 text-5xl font-black uppercase leading-none sm:text-7xl">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">
              {t("body")}
            </p>
          </div>
        </section>
        <section className="flex items-center px-5 py-14 sm:px-10 lg:px-16">
          <div className="w-full max-w-xl">
            {sent ? (
              <div
                role="status"
                className="border-l-4 border-emerald-600 bg-white p-6 text-lg font-bold leading-8 shadow-sm"
              >
                {t("sent")}
              </div>
            ) : null}
            {hasError ? (
              <div
                role="alert"
                className="mb-6 border-l-4 border-red-700 bg-white p-6 font-bold"
              >
                {t("error")}
              </div>
            ) : null}
            <form action={sendMagicLink} className="mt-7">
              <input type="hidden" name="locale" value={locale} />
              <label htmlFor="email" className="text-sm font-black uppercase">
                {t("email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t("placeholder")}
                className="mt-3 min-h-14 w-full rounded-none border-2 border-[var(--tmt-navy)] bg-white px-4 text-lg"
              />
              <button
                type="submit"
                className="mt-4 flex min-h-14 w-full items-center justify-center bg-[var(--tmt-orange)] px-5 py-3 font-black uppercase tracking-wide transition hover:bg-orange-300"
              >
                {t("submit")}
              </button>
            </form>
            <a
              href={`/${locale}`}
              className="mt-8 inline-flex min-h-12 items-center font-bold underline decoration-[var(--tmt-orange)] decoration-2 underline-offset-4"
            >
              {t("back")}
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
