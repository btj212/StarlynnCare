import Image from "next/image";
import {
  STARLYNN_AUTHOR_CREDENTIALS,
  STARLYNN_AUTHOR_DISPLAY_NAME,
  STARLYNN_AUTHOR_IMAGE_PATH,
  STARLYNN_AUTHOR_LICENSE,
} from "@/lib/seo/editor";

interface AuthorBylineProps {
  /** ISO date string for “Last reviewed” */
  lastReviewed: string;
  className?: string;
}

/**
 * Clinical byline for editorial guides — Star Lynn with circle-cropped photo,
 * credentials, and verifiable RN license number.
 */
export function AuthorByline({ lastReviewed, className = "" }: AuthorBylineProps) {
  const formatted = new Date(lastReviewed).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <aside
      className={`flex gap-4 items-start border-b border-paper-rule pb-8 mb-8 ${className ?? ""}`}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-paper-rule bg-paper-2">
        <Image
          src={STARLYNN_AUTHOR_IMAGE_PATH}
          alt=""
          width={48}
          height={48}
          className="object-cover object-top"
        />
      </div>
      <div className="min-w-0">
        <p className="font-[family-name:var(--font-sans)] font-semibold text-[15px] text-ink m-0">
          Reviewed by {STARLYNN_AUTHOR_DISPLAY_NAME}, {STARLYNN_AUTHOR_CREDENTIALS}
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
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
          Last reviewed {formatted}
        </p>
      </div>
    </aside>
  );
}
