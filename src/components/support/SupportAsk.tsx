"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { emitSupportClick } from "@/lib/analytics/clarityEvents";

const VENMO_HANDLE = "Blake-Jones-11";
const VENMO_NOTE = "StarlynnCare - thank you";
const DISMISS_KEY = "sl_support_ask_dismissed";

const AMOUNTS = [
  { label: "$5", amount: 5 },
  { label: "$10", amount: 10 },
  { label: "$25", amount: 25 },
  { label: "Other", amount: null },
] as const;

function venmoHref(amount: number | null): string {
  const note = encodeURIComponent(VENMO_NOTE);
  const base = `https://venmo.com/${VENMO_HANDLE}?txn=pay&note=${note}`;
  return amount != null ? `${base}&amount=${amount}` : base;
}

export function SupportAsk({
  source,
  variant,
}: {
  source: string;
  variant: "modal" | "inline";
}) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // Private mode / blocked storage — still show the ask.
    }
    setReady(true);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  if (!ready || dismissed) return null;

  const isModal = variant === "modal";

  return (
    <div
      className={
        isModal
          ? "mt-5 border-t border-clearing-rule-2 pt-5"
          : "mt-4 border-t border-paper-rule pt-4"
      }
    >
      <div className={isModal ? "flex flex-col gap-4" : "flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5"}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <div className="relative z-[1] h-14 w-14 overflow-hidden rounded-full border-2 border-paper bg-paper-2 shadow-sm">
              <Image
                src="/images/about/star.png"
                alt="Rebecca Lynn Starkey"
                fill
                className="object-cover object-[center_33%] brightness-110"
                sizes="56px"
              />
            </div>
            <div className="relative z-[2] -ml-3 h-14 w-14 overflow-hidden rounded-full border-2 border-paper bg-paper-2 shadow-sm">
              <Image
                src="/images/about/blake-jones.png"
                alt="Blake Jones"
                fill
                className="object-cover object-[center_20%] brightness-110"
                sizes="56px"
              />
            </div>
          </div>

          <p
            className={
              isModal
                ? "mt-3 font-[family-name:var(--font-sans)] text-[13.5px] leading-relaxed text-ink-2"
                : "mt-3 font-[family-name:var(--font-sans)] text-[13px] leading-relaxed text-ink-2"
            }
          >
            We&apos;re Star and Blake. Star is an RN who spent years inspecting
            care facilities; Blake builds the data behind this site. We just had
            our first baby, and we run StarlynnCare on nights and weekends.
            It&apos;s free for families to use, but not free for us to run. If
            this record helped, any support means a lot.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {AMOUNTS.map((opt) => {
              const amountKey = opt.amount == null ? "other" : String(opt.amount);
              return (
                <a
                  key={amountKey}
                  href={venmoHref(opt.amount)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => emitSupportClick(source, amountKey)}
                  aria-label={
                    opt.amount == null
                      ? `Support StarlynnCare on Venmo @${VENMO_HANDLE}`
                      : `Support StarlynnCare with $${opt.amount} on Venmo`
                  }
                  className={
                    opt.amount == null
                      ? "inline-flex h-9 items-center justify-center rounded-lg border border-clearing-rule-2 bg-transparent px-3 font-[family-name:var(--font-mono)] text-[12px] font-semibold tracking-wide text-ink-2 transition-colors hover:border-teal hover:text-teal"
                      : "inline-flex h-9 items-center justify-center rounded-lg bg-teal px-3 font-[family-name:var(--font-mono)] text-[12px] font-semibold tracking-wide text-paper transition-opacity hover:opacity-90"
                  }
                >
                  {opt.label}
                </a>
              );
            })}
          </div>

          <p className="mt-2 font-[family-name:var(--font-mono)] text-[10.5px] tracking-[0.04em] text-ink-4">
            Venmo @{VENMO_HANDLE}
          </p>
        </div>

        <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
          <div className="overflow-hidden rounded-lg border border-paper-rule bg-paper p-1.5">
            <Image
              src="/images/support/venmo-qr.png"
              alt={`Venmo QR code for @${VENMO_HANDLE}`}
              width={112}
              height={112}
            />
          </div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.04em] text-ink-4">
            or scan with your phone
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="mt-3 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-4 transition-colors hover:text-ink-2 hover:underline"
      >
        Maybe later
      </button>
    </div>
  );
}
