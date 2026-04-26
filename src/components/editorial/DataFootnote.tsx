interface DataFootnoteProps {
  source: string;
  refreshed?: string;
  /** Optional extra note shown after the date */
  note?: string;
}

/**
 * Small JetBrains Mono caption attached to any citable data block.
 * Appears below stats, findings sentences, and cost-band figures.
 */
export function DataFootnote({ source, refreshed, note }: DataFootnoteProps) {
  return (
    <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em]">
      Source: {source}
      {refreshed && <> · Refreshed {refreshed}</>}
      {note && <> · {note}</>}
    </p>
  );
}
