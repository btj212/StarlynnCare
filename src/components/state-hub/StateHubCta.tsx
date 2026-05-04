import Link from "next/link";

type Props = {
  facilityCount: number;
  ctaHref: string;
};

export function StateHubCta({ facilityCount, ctaHref }: Props) {
  return (
    <section style={{ background: "var(--color-rust)", borderTop: 0 }}>
      <div
        className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-16 grid gap-10 items-center md:grid-cols-[1fr_auto]"
      >
        <div>
          <h2
            className="font-[family-name:var(--font-display)] font-normal leading-[1.05] tracking-[-0.015em] m-0 text-white"
            style={{ fontSize: "clamp(32px, 3.5vw, 48px)" }}
          >
            Find the right facility, <em>without the sales funnel.</em>
          </h2>
          <p className="mt-2.5 text-[17px] text-white/85 max-w-[50ch]">
            Search by ZIP, compare A–F grades, read every dated citation. Free, forever, with no operator behind the recommendation.
          </p>
        </div>
        <Link
          href={ctaHref}
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 bg-ink text-paper px-[18px] py-[10px] rounded-full text-[14px] font-medium hover:bg-black transition-colors no-underline whitespace-nowrap"
        >
          Search {facilityCount > 0 ? facilityCount.toLocaleString() : ""} facilities
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
