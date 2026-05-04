import Image from "next/image";
import type { ReactNode } from "react";
import { ZipSearch } from "@/components/site/ZipSearch";

type Props = {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  illustrationSrc: string;
  illustrationAlt: string;
  /** e.g. "Live across 58 CA counties" */
  liveLabel: string;
  roadmapNote?: string;
};

export function StateHubHero({
  eyebrow,
  title,
  subtitle,
  illustrationSrc,
  illustrationAlt,
  liveLabel,
  roadmapNote = "· Texas Q2 · Florida Q2",
}: Props) {
  return (
    <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14 md:py-16">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 sm:mb-7 font-[family-name:var(--font-mono)] text-[10.5px] sm:text-[11.5px] uppercase tracking-[0.18em] text-rust">
          <span className="h-px w-6 sm:w-9 shrink-0 bg-rust opacity-60" aria-hidden />
          <span className="min-w-0 flex-1 basis-[min(100%,14rem)] sm:flex-none sm:basis-auto">
            {eyebrow}
          </span>
          <span className="h-px min-w-[2rem] flex-1 basis-0 bg-rust opacity-60 max-sm:hidden" aria-hidden />
        </div>

        <div className="grid gap-10 md:gap-16 items-start md:grid-cols-[1.15fr_1fr]">
          <div>
            <h1
              className="font-[family-name:var(--font-display)] font-normal leading-[0.98] tracking-[-0.02em] text-ink mb-5 sm:mb-6 max-w-none md:max-w-[16ch]"
              style={{ fontSize: "clamp(32px, 5vw + 0.5rem, 84px)" }}
            >
              {title}
            </h1>

            <p className="font-[family-name:var(--font-display)] italic text-[18px] sm:text-[22px] leading-[1.45] text-ink-3 mb-6 sm:mb-8 max-w-[40ch]">
              {subtitle}
            </p>

            <div className="w-full max-w-[460px] min-w-0">
              <ZipSearch variant="editorial" />
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-3 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.08em] text-ink-3">
              <span className="flex items-center gap-1.5 text-grade-a">
                <span className="live-dot" aria-hidden />
                {liveLabel}
              </span>
              <span className="text-ink-4">{roadmapNote}</span>
            </div>
          </div>

          <div className="hidden md:block">
            <div
              className="relative w-full border border-paper-rule overflow-hidden"
              style={{ aspectRatio: "1/1", background: "var(--color-paper-2)" }}
            >
              <Image
                src={illustrationSrc}
                alt={illustrationAlt}
                fill
                sizes="(max-width: 768px) 0px, 40vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
