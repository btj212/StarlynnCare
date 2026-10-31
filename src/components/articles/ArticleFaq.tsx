export type FaqPair = { q: string; a: string };

export function ArticleFaq({ items }: { items: readonly FaqPair[] }) {
  return (
    <section>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">Common questions</h2>
      {items.map((item) => (
        <div key={item.q} className="mt-6">
          <h3 className="font-[family-name:var(--font-display)] text-xl text-navy">{item.q}</h3>
          <p className="mt-2 text-[17px] leading-relaxed text-ink-2">{item.a}</p>
        </div>
      ))}
    </section>
  );
}
