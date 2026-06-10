import Image from "next/image";
import {
  STARLYNN_AUTHOR_CREDENTIALS,
  STARLYNN_AUTHOR_DISPLAY_NAME,
  STARLYNN_AUTHOR_IMAGE_PATH,
  STARLYNN_AUTHOR_LICENSE,
} from "@/lib/seo/editor";

interface AuthorBylineProps {
  /** ISO date string for "Last reviewed". Omit to hide the date line (e.g. on facility pages). */
  lastReviewed?: string;
  className?: string;
  /**
   * Drop the default bottom frame (`border-b pb-8 mb-8`). Prefer this over
   * passing `className="border-b-0 pb-0 mb-0"` — those conflict with the
   * defaults on the same properties, so the winner depends on CSS source
   * order, which can leave ~64px of dead space below the byline.
   */
  bare?: boolean;
}

/**
 * Clinical byline for editorial guides — Star Lynn with circle-cropped photo,
 * credentials, and verifiable RN license number.
 */
export function AuthorByline({ lastReviewed, className = "", bare = false }: AuthorBylineProps) {
  const formatted = lastReviewed
    ? new Date(lastReviewed).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const base = bare
    ? "flex gap-4 items-start"
    : "flex gap-4 items-start border-b border-paper-rule pb-8 mb-8";

  return (
    <aside className={`${base} ${className}`.trim()}>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-paper-rule bg-paper-2">
        <Image
          src={STARLYNN_AUTHOR_IMAGE_PATH}
          alt=""
          width={96}
          height={96}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="font-[family-name:var(--font-sans)] font-semibold text-[15px] text-ink m-0">
          Methodology overseen by {STARLYNN_AUTHOR_DISPLAY_NAME}, {STARLYNN_AUTHOR_CREDENTIALS}
        </p>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em]">
          California RN License {STARLYNN_AUTHOR_LICENSE} · Verify at{" "}
          <a
            href="https://search.dca.ca.gov/"
            className="text-teal underline underline-offset-2 hover:text-teal/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            search.dca.ca.gov
          </a>
        </p>
        {formatted ? (
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
            Last reviewed {formatted}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
