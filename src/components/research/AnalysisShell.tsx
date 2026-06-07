import Link from "next/link";

export type KeyFinding = {
  /** Big numeric or short categorical headline (e.g. "1 in 5", "+132%", "Fall"). */
  value: string;
  /** Plain-language label under the value. */
  label: string;
  /** Optional small-caps caption (source / scope hint). */
  caption?: string;
  /** Visual emphasis for the value color. */
  tone?: "neutral" | "warn" | "alarm" | "good";
};

export type AnalysisSource = {
  label: string;
  url?: string;
};

type AnalysisShellProps = {
  eyebrow: string;
  title: string;
  dek: string;
  bylineDate: string;
  scope: string;
  keyFindings: KeyFinding[];
  methodologyDisclosure: string;
  sources: AnalysisSource[];
  children: React.ReactNode;
};

const TONE_CLASSES: Record<NonNullable<KeyFinding["tone"]>, string> = {
  neutral: "text-ink",
  warn: "text-gold",
  alarm: "text-rust",
  good: "text-teal",
};

/**
 * Shared layout for /research/* analysis pages. Editorial pattern intentionally
 * simpler than /reports/* flagship reports: dense, parsable, designed for both
 * skim-readers and LLM crawlers to extract findings cleanly.
 */
export function AnalysisShell({
  eyebrow,
  title,
  dek,
  bylineDate,
  scope,
  keyFindings,
  methodologyDisclosure,
  sources,
  children,
}: AnalysisShellProps) {
  return (
    <>
      <div
        className="border-b border-teal/20"
        style={{ background: "var(--color-teal-deep)", color: "var(--color-paper)" }}
      >
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-10 py-14 md:py-18">
          <nav
            className="flex items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] opacity-60"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="hover:opacity-100 transition-opacity">
              Home
            </Link>
            <span aria-hidden>›</span>
            <Link href="/research" className="hover:opacity-100 transition-opacity">
              Research
            </Link>
            <span aria-hidden>›</span>
            <span className="opacity-80">{eyebrow}</span>
          </nav>

          <div className="mb-3 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] opacity-70">
            Analysis · {scope}
          </div>

          <h1
            className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.06] tracking-[-0.02em] mb-5 max-w-[900px]"
            style={{ color: "var(--color-paper)" }}
          >
            {title}
          </h1>

          <p
            className="text-[18px] leading-[1.6] max-w-[62ch] mb-8 opacity-85"
            style={{ color: "var(--color-paper)" }}
          >
            {dek}
          </p>

          <p className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] opacity-55">
            StarlynnCare Research · {bylineDate}
          </p>
        </div>
      </div>

      <div
        className="border-b border-paper-rule"
        style={{ background: "var(--color-paper-2)" }}
      >
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-10 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {keyFindings.slice(0, 3).map((kf, i) => (
              <div key={i}>
                <p
                  className={`font-[family-name:var(--font-mono)] text-[clamp(26px,3.2vw,36px)] font-semibold leading-none mb-1 ${TONE_CLASSES[kf.tone ?? "neutral"]}`}
                >
                  {kf.value}
                </p>
                <p className="text-[13px] text-ink-3 leading-[1.4]">{kf.label}</p>
                {kf.caption && (
                  <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4 mt-1">
                    {kf.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-10 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12 lg:gap-16 items-start">
            <article className="max-w-[68ch]">{children}</article>

            <aside className="space-y-8 lg:sticky lg:top-8">
              <div
                className="rounded-xl border border-paper-rule p-6 text-[13px] leading-[1.65] text-ink-2 space-y-3"
                style={{ background: "var(--color-paper-2)" }}
              >
                <h2 className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
                  About this analysis
                </h2>
                {methodologyDisclosure
                  .split("\n\n")
                  .map((para, i) => (
                    <p key={i} className="text-[12.5px]">
                      {para}
                    </p>
                  ))}
                <p>
                  <Link
                    href="/methodology"
                    className="text-teal underline underline-offset-4 hover:text-teal/80 text-[12.5px]"
                  >
                    Full methodology →
                  </Link>
                </p>
              </div>

              {sources.length > 0 && (
                <div
                  className="rounded-xl border border-paper-rule p-6"
                  style={{ background: "var(--color-paper-2)" }}
                >
                  <h2 className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-ink-4 mb-3">
                    Sources
                  </h2>
                  <ul className="space-y-2 text-[12.5px] text-ink-2 list-none m-0 p-0">
                    {sources.map((s, i) => (
                      <li key={i}>
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal underline underline-offset-4 hover:text-teal/80"
                          >
                            {s.label}
                          </a>
                        ) : (
                          <span>{s.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                className="rounded-xl border border-teal/20 p-6"
                style={{ background: "var(--color-teal-soft)" }}
              >
                <p
                  className="text-[13px] font-medium mb-3"
                  style={{ color: "var(--color-teal-deep)" }}
                >
                  More analyses
                </p>
                <Link
                  href="/research"
                  className="inline-block w-full text-center px-4 py-2.5 rounded text-white text-[13px] font-medium transition-colors"
                  style={{ background: "var(--color-teal)" }}
                >
                  All StarlynnCare research →
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

export function AnalysisH2({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,30px)] leading-[1.1] tracking-[-0.01em] text-ink mt-14 mb-5 first:mt-0"
    >
      {children}
    </h2>
  );
}

export function AnalysisProse({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 space-y-4">
      {children}
    </div>
  );
}

export function AnalysisMethodNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13.5px] leading-[1.6] text-ink-3 italic border-l-2 border-paper-rule pl-4 my-5">
      {children}
    </p>
  );
}
