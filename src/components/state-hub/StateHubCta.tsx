import Image from "next/image";
import Link from "next/link";

type Props = {
  facilityCount: number;
  ctaHref: string;
};

/**
 * Closing CTA band shared by national home and state hubs.
 * Clearing visual (teal band + illustration); production copy preserved.
 */
export function StateHubCta({ facilityCount, ctaHref }: Props) {
  return (
    <section className="bg-teal">
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:gap-14 md:px-[60px] md:py-[64px]">
        <div>
          <h2
            className="m-0 font-[family-name:var(--font-display)] font-normal leading-[1.05] tracking-[-0.015em] text-white"
            style={{ fontSize: "clamp(32px, 3.5vw, 42px)" }}
          >
            Find the right facility, <em>without the sales funnel.</em>
          </h2>
          <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed text-[#C6DAD3]">
            Search by ZIP, compare peer rankings, read every dated citation — with no operator behind the recommendation.
          </p>
          <div className="mt-7">
            <Link
              href={ctaHref}
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-[18px] py-[11px] text-[14.5px] font-semibold text-teal no-underline transition-colors hover:bg-clearing-tint sm:w-auto"
            >
              Search {facilityCount > 0 ? facilityCount.toLocaleString() : ""} facilities
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
        <div className="relative hidden overflow-hidden rounded-[22px] border border-white/15 md:block" style={{ aspectRatio: "16/10" }}>
          <Image
            src="/illustrations/desk-family-reviewing-records.png"
            alt="Illustrated family reviewing facility records together at a desk"
            fill
            sizes="(max-width: 768px) 0px, 40vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
