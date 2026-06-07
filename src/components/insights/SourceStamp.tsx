interface SourceStampProps {
  source: string;
  asOf: string;
  /** Optional additional note */
  note?: string;
}

/**
 * Single source-of-truth "data as of" citation stamp.
 * Used below charts and pull-stat blocks on insights pages.
 */
export function SourceStamp({ source, asOf, note }: SourceStampProps) {
  return (
    <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em]">
      Source: {source} · Data as of {asOf}
      {note && <> · {note}</>}
    </p>
  );
}
