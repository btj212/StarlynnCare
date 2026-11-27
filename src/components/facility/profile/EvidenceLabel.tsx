type Props = {
  /** Source line shown today. A later task can pass a three-label value. */
  label: string;
};

export function EvidenceLabel({ label }: Props) {
  const text = label.trim();
  if (!text) return null;
  return (
    <p className="mt-2 mb-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-3">
      {text}
    </p>
  );
}
