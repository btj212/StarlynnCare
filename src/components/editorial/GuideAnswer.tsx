import Link from "next/link";

type Jump = { href: string; label: string };
type Action = { href: string; label: string; external?: boolean };

/**
 * 40–60 word above-the-fold answer plus optional jump links and a next action.
 * Used on library and state guides so the searcher's question is answered
 * before the fold, then they have somewhere to go.
 */
export function GuideAnswer({
  q,
  a,
  jumps,
  action,
}: {
  q: string;
  a: string;
  jumps?: Jump[];
  action?: Action;
}) {
  return (
    <aside
      className="mt-8 max-w-[68ch] rounded-[16px] border border-clearing-rule-2 bg-paper px-5 py-5 shadow-[var(--shadow-card)]"
      aria-label="Direct answer"
    >
      <p className="m-0 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-teal">
        Answer
      </p>
      <h2 className="mt-2 mb-2 font-[family-name:var(--font-display)] text-[20px] leading-snug text-ink sm:text-[22px]">
        {q}
      </h2>
      <p className="m-0 font-[family-name:var(--font-sans)] text-[16px] leading-[1.6] text-ink-2 sm:text-[17px]">
        {a}
      </p>
      {jumps && jumps.length > 0 ? (
        <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {jumps.map((jump) => (
            <a
              key={jump.href}
              href={jump.href}
              className="font-[family-name:var(--font-sans)] text-[13px] font-semibold text-teal underline underline-offset-4"
            >
              {jump.label}
            </a>
          ))}
        </nav>
      ) : null}
      {action ? (
        action.external ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal px-4 text-[14px] font-semibold text-paper no-underline hover:bg-teal-deep"
          >
            {action.label}
          </a>
        ) : (
          <Link
            href={action.href}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal px-4 text-[14px] font-semibold text-paper no-underline hover:bg-teal-deep"
          >
            {action.label}
          </Link>
        )
      ) : null}
    </aside>
  );
}
