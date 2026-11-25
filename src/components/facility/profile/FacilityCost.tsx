import { SectionHead } from "@/components/editorial/SectionHead";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { formatCurrency, getStateCostBand } from "@/lib/content/stateCostBands";
import { summarizeHomeCost, type CostRow, type PriceBand } from "@/lib/cost/costBand";

function formatBand(band: PriceBand): string {
  return `${formatCurrency(band.low)}\u2013${formatCurrency(band.high)}`;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const prose = "m-0 max-w-[62ch] text-[16px] leading-[1.6] text-ink-2";

export function FacilityCost({
  rows,
  stateCode,
  stateName,
}: {
  rows: CostRow[];
  stateCode: string;
  stateName: string;
}) {
  const cost = summarizeHomeCost(rows);
  const state = getStateCostBand(stateCode);

  return (
    <section id="cost" className="scroll-mt-36 border-b border-clearing-rule py-16 md:scroll-mt-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px]">
        <SectionHead
          label="Cost"
          title={
            <>
              What it <em>costs.</em>
            </>
          }
        />
        {cost?.kind === "memory_care" && (
          <>
            <p className="m-0 font-[family-name:var(--font-display)] text-[clamp(28px,3.4vw,40px)] leading-[1.1] text-ink">
              {formatBand(cost.band)} <span className="text-[0.5em] text-ink-3">a month, memory care</span>
            </p>
            <p className={`${prose} mt-4`}>
              A range from the memory care price listed by {cost.sources.map((s) => s.label).join(" and ")}.
              It is a listed price, not a quote, and it is shown as a range. Ask the home for its current
              rate and what it includes.
            </p>
          </>
        )}
        {cost?.kind === "assisted_living" && (
          <>
            <p className="m-0 font-[family-name:var(--font-display)] text-[clamp(28px,3.4vw,40px)] leading-[1.1] text-ink">
              {formatBand(cost.band)} <span className="text-[0.5em] text-ink-3">a month, assisted living</span>
            </p>
            <p className={`${prose} mt-4`}>
              This is the listed price of a private room in assisted living, from{" "}
              {cost.sources.map((s) => s.label).join(" and ")}. No memory care price is listed for this
              home. Memory care is priced separately and is usually higher, so ask the home for its
              memory care rate.
            </p>
          </>
        )}
        {!cost && (
          <>
            <p className={prose}>
              No price for this home is listed in the directories we read. Typical memory care in {stateName} runs{" "}
              <strong className="font-semibold">
                {formatCurrency(state.cityLow)}&ndash;{formatCurrency(state.cityHigh)}
              </strong>{" "}
              a month. That is a state estimate, not this home&apos;s rate.
            </p>
            <DataFootnote source={`Regional estimate · ${state.source}`} note="Ask the home for a written quote" />
          </>
        )}
        {cost && (
          <p className="mt-4 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] text-ink-4">
            Source:{" "}
            {cost.sources.map((s, index) => (
              <span key={s.label}>
                {index > 0 && ", "}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                    {s.label}
                  </a>
                ) : (
                  s.label
                )}
              </span>
            ))}{" "}
            · Checked {formatDate(cost.checked)} · Listed prices change; this is not a quote
          </p>
        )}
      </div>
    </section>
  );
}
