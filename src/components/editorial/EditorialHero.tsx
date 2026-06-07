import Image from "next/image";
import type { ReactNode } from "react";

type Aspect = "4/3" | "1/1";

const aspectClass: Record<Aspect, string> = {
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-square",
};

type Props = {
  src: string;
  alt: string;
  caption?: ReactNode;
  /** @default "4/3" */
  aspect?: Aspect;
  priority?: boolean;
};

/**
 * Editorial article hero — matches homepage illustration framing (paper border, paper-2 ground).
 */
export function EditorialHero({
  src,
  alt,
  caption,
  aspect = "4/3",
  priority = false,
}: Props) {
  return (
    <figure className="my-8 max-w-[720px]">
      <div
        className={`relative w-full overflow-hidden border border-paper-rule ${aspectClass[aspect]}`}
        style={{ background: "var(--color-paper-2)" }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className="object-cover"
          priority={priority}
        />
      </div>
      {caption ? (
        <figcaption className="mt-3 font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.04em] italic">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
