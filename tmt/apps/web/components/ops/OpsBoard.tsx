"use client";

import type { UtteranceRow } from "@tmt/db";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppLocale } from "../../i18n/routing";
import { FIXTURE_LIVE_UTTERANCE_DELAY_MS } from "../../lib/ops/fixtures";
import type { OpsCallCard } from "../../lib/ops/mapper";
import {
  OPS_REALTIME_EVENT,
  OPS_REALTIME_SCHEMA,
  OPS_REALTIME_TABLES,
} from "../../lib/ops/realtime";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

function readableEnum(value: string): string {
  return value.replaceAll("_", " ");
}

function formatTime(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function transcriptWindow(card: OpsCallCard): string {
  const first = card.utterances[0];
  const last = card.utterances.at(-1);
  if (!first || !last) {
    return "—";
  }
  const end = last.ended_at ?? last.started_at;
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(end).getTime() - new Date(first.started_at).getTime()) / 1000,
    ),
  );
  return `${card.utterances.length} · ${seconds}s`;
}

function CallCard({
  card,
  locale,
}: {
  card: OpsCallCard;
  locale: AppLocale;
}) {
  const t = useTranslations("ops");
  const statusClass =
    card.call.status === "in_progress"
      ? "bg-emerald-100 text-emerald-900"
      : card.call.status.startsWith("handoff")
        ? "bg-orange-100 text-orange-950"
        : "bg-slate-100 text-slate-800";

  return (
    <article className="border border-slate-300 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
        <div>
          <p className="font-display text-3xl font-black">{card.maskedCaller}</p>
          <p className="mt-1 text-sm text-slate-600">
            {t("started")}: {formatTime(card.call.started_at, locale)}
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-sm font-black uppercase ${statusClass}`}
        >
          {t(`states.${card.call.status}`)}
        </span>
      </header>

      {card.activeEscalation ? (
        <div
          role="alert"
          className="border-b border-red-900 bg-red-950 p-4 text-white"
        >
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-200">
            {t("escalation")} · {card.activeEscalation.priority.toUpperCase()}
          </p>
          <p className="mt-1 font-bold">{card.activeEscalation.reason}</p>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
        <div className="bg-white p-4">
          <dt className="text-xs font-black uppercase text-slate-500">
            {t("language")}
          </dt>
          <dd className="mt-1 text-lg font-black uppercase">
            {card.call.language}
          </dd>
        </div>
        <div className="bg-white p-4">
          <dt className="text-xs font-black uppercase text-slate-500">
            {t("duration")}
          </dt>
          <dd className="mt-1 text-lg font-black">{transcriptWindow(card)}</dd>
        </div>
        <div className="bg-white p-4">
          <dt className="text-xs font-black uppercase text-slate-500">
            {t("consent")}
          </dt>
          <dd className="mt-1 font-bold">
            {card.consents[0]
              ? `${readableEnum(card.consents[0].kind)} · ${
                  card.consents[0].granted ? t("granted") : t("declined")
                }`
              : t("noConsent")}
          </dd>
        </div>
        <div className="bg-white p-4">
          <dt className="text-xs font-black uppercase text-slate-500">
            {t("handoff")}
          </dt>
          <dd className="mt-1 font-bold">
            {card.latestHandoff
              ? `${readableEnum(card.latestHandoff.status)} · ${readableEnum(
                  card.latestHandoff.trigger,
                )}`
              : t("noHandoff")}
          </dd>
        </div>
      </dl>

      <section className="p-5" aria-label={t("transcript")}>
        <h2 className="text-sm font-black uppercase tracking-[0.16em]">
          {t("transcript")}
        </h2>
        {card.utterances.length === 0 ? (
          <p className="mt-4 text-slate-600">{t("noTranscript")}</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {card.utterances.map((utterance) => (
              <li
                key={utterance.id}
                data-utterance-id={utterance.id}
                className="grid gap-1 border-l-4 border-slate-200 pl-4 sm:grid-cols-[7rem_1fr]"
              >
                <div className="text-xs font-black uppercase text-slate-500">
                  <p>{readableEnum(utterance.speaker)}</p>
                  <time dateTime={utterance.started_at}>
                    {new Intl.DateTimeFormat(locale, {
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    }).format(new Date(utterance.started_at))}
                  </time>
                </div>
                <div>
                  <p className="font-semibold leading-6">
                    {utterance.text_original}
                  </p>
                  {utterance.text_en &&
                  utterance.text_en !== utterance.text_original ? (
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      <span className="font-bold">{t("english")}:</span>{" "}
                      {utterance.text_en}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

export function OpsBoard({
  cards,
  fixtureLiveUtterance,
  fixtureMode,
  locale,
}: {
  cards: OpsCallCard[];
  fixtureLiveUtterance: UtteranceRow | null;
  fixtureMode: boolean;
  locale: AppLocale;
}) {
  const t = useTranslations("ops");
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [showFixtureUpdate, setShowFixtureUpdate] = useState(false);

  useEffect(() => {
    if (fixtureMode) {
      if (fixtureLiveUtterance === null) {
        return;
      }
      const timeout = window.setTimeout(() => {
        setShowFixtureUpdate(true);
      }, FIXTURE_LIVE_UTTERANCE_DELAY_MS);
      return () => window.clearTimeout(timeout);
    }

    if (fixtureLiveUtterance !== null) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let channel = supabase.channel("ops-live-board");
    for (const table of OPS_REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: OPS_REALTIME_EVENT,
          schema: OPS_REALTIME_SCHEMA,
          table,
        },
        () => router.refresh(),
      );
    }
    channel.subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fixtureLiveUtterance, fixtureMode, router]);
  const liveCards =
    fixtureLiveUtterance !== null && showFixtureUpdate
      ? cards.map((card) =>
          card.call.id === fixtureLiveUtterance.call_id &&
          !card.utterances.some(
            (utterance) => utterance.id === fixtureLiveUtterance.id,
          )
            ? {
                ...card,
                utterances: [...card.utterances, fixtureLiveUtterance],
              }
            : card,
        )
      : cards;

  return (
    <div>
      <p
        className="mb-5 inline-flex min-h-12 items-center rounded-full bg-white px-4 text-sm font-black uppercase tracking-wide"
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          className={`mr-2 h-3 w-3 rounded-full ${
            fixtureMode || connected ? "bg-emerald-600" : "bg-amber-500"
          }`}
        />
        {fixtureMode ? t("fixture") : t("live")}
      </p>
      {liveCards.length === 0 ? (
        <p className="border border-slate-300 bg-white p-8 text-lg font-bold">
          {t("empty")}
        </p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {liveCards.map((card) => (
            <CallCard key={card.call.id} card={card} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
