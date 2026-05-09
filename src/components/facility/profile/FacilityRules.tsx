"use client";

import { useState } from "react";
import type { FacilityProfile } from "@/lib/facility/loadFacilityProfile";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { RuleIcon } from "@/lib/states/profileConfig";

// ─── Icons ──────────────────────────────────────────────────────────────────

function RuleIconEl({ icon }: { icon: RuleIcon }) {
  switch (icon) {
    case "training":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.963 8.963 0 00-4.25 1.065V16.82zM9.25 4.065A8.963 8.963 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
        </svg>
      );
    case "staff":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
        </svg>
      );
    case "health":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 002 3.5V5c0 1.149.15 2.263.43 3.326a13.022 13.022 0 009.244 9.244c1.063.28 2.177.43 3.326.43h1.5a1.5 1.5 0 001.5-1.5v-1.148a1.5 1.5 0 00-1.175-1.465l-3.223-.716a1.5 1.5 0 00-1.767 1.052l-.267.933c-.117.41-.555.643-.95.48a11.542 11.542 0 01-6.254-6.254c-.163-.395.07-.833.48-.95l.933-.267a1.5 1.5 0 001.051-1.767l-.716-3.223A1.5 1.5 0 004.648 2H3.5z" clipRule="evenodd" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v11.75A2.75 2.75 0 0016.75 18h-12A2.75 2.75 0 012 15.25V3.5zm3.75 7a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0 3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zM5 5.75A.75.75 0 015.75 5h4.5a.75.75 0 01.75.75v2.5a.75.75 0 01-.75.75h-4.5A.75.75 0 015 8.25v-2.5z" clipRule="evenodd" /><path d="M16.5 6.5h-1v8.75a1.25 1.25 0 002.5 0V8a1.5 1.5 0 00-1.5-1.5z" />
        </svg>
      );
    case "enforce":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.749zm4.196 5.954a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
      );
  }
}

function fmtCiteDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function FacilityRules({ profile }: { profile: FacilityProfile }) {
  const { rulesCards } = profile;
  const [openId, setOpenId] = useState<string | null>(rulesCards[0]?.id ?? null);

  if (rulesCards.length === 0) return null;

  return (
    <section id="rules" className="border-b border-paper-rule py-16">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <SectionHead
          label="§ 04 · The Rulebook"
          title={
            <>
              The rules that <em>apply to this facility.</em>
            </>
          }
          deck="State requirements with the exact regulation citation, plain-language explanation, and a question to ask on tour. Rules this facility has been cited for appear first."
        />

        <div className="border-t-2 border-ink">
          {rulesCards.map((rule) => {
            const isOpen = openId === rule.id;
            return (
              <div
                key={rule.id}
                className="cursor-pointer border-b border-paper-rule/60 py-5 last:border-b-0"
                onClick={() => setOpenId(isOpen ? null : rule.id)}
              >
                {/* Row */}
                <div className="grid items-center gap-4" style={{ gridTemplateColumns: "56px 1fr auto auto" }}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-soft text-teal">
                    <RuleIconEl icon={rule.icon} />
                  </div>
                  <div>
                    <span className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.005em]">
                      {rule.question}
                    </span>
                    <span className="ml-2.5 inline-block rounded bg-paper-2 px-2 py-0.5 align-[4px] font-[family-name:var(--font-mono)] text-[10.5px] tracking-[0.04em] text-ink-3">
                      {rule.regCite}
                    </span>
                  </div>
                  {rule.citedDate ? (
                    <span className="shrink-0 bg-gold-soft px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[#6E5520]">
                      Cited {fmtCiteDate(rule.citedDate)}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="text-rust text-[22px] transition-transform duration-200" style={{ display: "inline-block", transform: isOpen ? "rotate(45deg)" : "none" }}>
                    +
                  </span>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div className="mt-4 grid gap-8 pl-[74px] sm:grid-cols-2">
                    <div>
                      <h5 className="mb-2.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-ink-3">
                        Plain language
                      </h5>
                      <p className="text-[14.5px] leading-[1.5] text-ink-2">{rule.plain}</p>
                    </div>
                    <div className="border-l-2 border-rust bg-paper-2 px-4 py-4">
                      <h5 className="mb-2.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-ink-3">
                        Ask on tour
                      </h5>
                      <p className="font-[family-name:var(--font-display)] text-[16px] italic leading-[1.35] text-ink">
                        &ldquo;{rule.ask}&rdquo;
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
