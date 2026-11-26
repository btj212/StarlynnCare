import { SectionHead } from "@/components/editorial/SectionHead";
import {
  neighborhoodsPresent,
  type AreasServed,
} from "@/lib/city-hub/areas";

export function CityAreasServed({
  spec,
  zips,
}: {
  spec: AreasServed;
  zips: Array<string | null | undefined>;
}) {
  const present = neighborhoodsPresent(spec, zips);
  if (present.length === 0) return null;

  return (
    <section className="border-b border-clearing-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-14">
        <SectionHead label="Areas served" title={<>{spec.heading}</>} />
        <p className="mt-4 max-w-[72ch] text-[16px] leading-[1.7] text-ink-2">{spec.intro}</p>
        <ul className="mt-6 m-0 grid max-w-[72ch] list-none gap-2 p-0 sm:grid-cols-2">
          {present.map((row) => (
            <li key={row.name} className="text-[15px] text-ink">
              <span className="font-medium">{row.name}</span>
              <span className="ml-2 font-[family-name:var(--font-mono)] text-[12px] text-ink-3">
                {row.zips.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
