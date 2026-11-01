import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { OpsBoard } from "../../../components/ops/OpsBoard";
import { isAppLocale } from "../../../i18n/routing";
import { loadRawOpsSnapshot } from "../../../lib/ops/data";
import {
  fixtureLiveUtterance,
  fixtureOpsSnapshot,
} from "../../../lib/ops/fixtures";
import { mapOpsSnapshot } from "../../../lib/ops/mapper";
import { requireOpsSession } from "../../../lib/ops/session";
import { canonicalFor } from "../../../lib/seo";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { signOut } from "./actions";

type OpsParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: OpsParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = isAppLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: safeLocale, namespace: "ops" });
  return {
    title: t("title"),
    alternates: { canonical: canonicalFor(`/${safeLocale}/ops`) },
    robots: { index: false, follow: false },
  };
}

export default async function OpsPage({ params }: { params: OpsParams }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    return null;
  }
  setRequestLocale(locale);
  const t = await getTranslations("ops");
  const session = await requireOpsSession(locale);
  const rawSnapshot = session.fixtureMode
    ? fixtureOpsSnapshot()
    : await loadRawOpsSnapshot(await createSupabaseServerClient());
  const cards = mapOpsSnapshot(rawSnapshot);

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b-4 border-[var(--tmt-orange)] bg-[var(--tmt-navy)] text-white">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <a
            href={`/${locale}`}
            className="font-display flex min-h-12 items-center text-3xl font-black"
          >
            TMT <span className="ml-2 text-[var(--tmt-orange)]">OPS</span>
          </a>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm font-bold">
              {session.profile.display_name} · {session.profile.role}
            </p>
            <form action={signOut}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="min-h-12 border-2 border-white px-4 font-black uppercase transition hover:bg-white hover:text-[var(--tmt-navy)]"
              >
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-[100rem] px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--tmt-orange)]">
          {t("eyebrow")}
        </p>
        <h1 className="font-display mt-3 text-5xl font-black uppercase leading-none sm:text-7xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">{t("subtitle")}</p>
        <div className="mt-8">
          <OpsBoard
            cards={cards}
            fixtureLiveUtterance={
              session.fixtureMode ? fixtureLiveUtterance() : null
            }
            fixtureMode={session.fixtureMode}
            locale={locale}
          />
        </div>
      </section>
    </main>
  );
}
