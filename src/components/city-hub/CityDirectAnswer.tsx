export function CityDirectAnswer({ q, a }: { q: string; a: string }) {
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
    </aside>
  );
}
