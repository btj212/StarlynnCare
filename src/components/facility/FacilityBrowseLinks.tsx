import Link from "next/link";

type Props = {
  cityDisplayName: string;
  citySlug: string;
  stateSlug: string;
  stateDisplayName: string;
  county?: { slug: string; name: string } | null;
};

/**
 * Prominent links back to the city listing hub and parent county hub (when applicable).
 */
export function FacilityBrowseLinks({
  cityDisplayName,
  citySlug,
  stateSlug,
  stateDisplayName,
  county,
}: Props) {
  return (
    <nav
      aria-label="Browse memory care listings"
      className="rounded-lg border border-sc-border bg-paper-2/80 px-5 py-4 shadow-card"
    >
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-rust mb-3">
        Explore listings
      </p>
      <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6 text-[14px] m-0 p-0 list-none">
        <li>
          <Link
            href={`/${stateSlug}/${citySlug}`}
            className="font-medium text-teal hover:underline underline-offset-4"
          >
            All memory care in {cityDisplayName}
          </Link>
          <span className="text-muted text-[13px] block sm:inline sm:ml-1">
            ({stateDisplayName} · full directory for this city)
          </span>
        </li>
        {county ? (
          <li>
            <Link
              href={`/${stateSlug}/${county.slug}`}
              className="font-medium text-teal hover:underline underline-offset-4"
            >
              Browse {county.name}
            </Link>
            <span className="text-muted text-[13px] block sm:inline sm:ml-1">
              (county-wide hub · nearby cities)
            </span>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
