import {
  COMING_COUNTIES,
  CALIFORNIA_EDITORIAL_CARDS,
  CALIFORNIA_METHODOLOGY_STEPS,
  californiaStatItems,
} from "@/lib/stateHubConfig";
import { getSeasonAndYear } from "@/lib/data/stateHub";
import type { CaliforniaStateHubData } from "@/lib/data/stateHub";
import { CA_FAQS } from "@/lib/content/stateFaqs";
import { StateHubHero } from "./StateHubHero";
import { StateHubStats } from "./StateHubStats";
import { StateHubMethodology } from "./StateHubMethodology";
import { StateHubBrowse } from "./StateHubBrowse";
import { StateHubEditorial } from "./StateHubEditorial";
import { StateHubReviews } from "./StateHubReviews";
import { StateHubFaq } from "./StateHubFaq";
import { StateHubCta } from "./StateHubCta";

type Props = {
  data: CaliforniaStateHubData;
};

export function CaliforniaStateHubSections({ data }: Props) {
  const { season, year } = getSeasonAndYear();
  const statItems = californiaStatItems(data.stats);
  const { counties, topCities, stats, sampleReviews } = data;

  return (
    <>
      <StateHubHero
        eyebrow={`California Edition · Vol. 02 · ${season} ${year}`}
        title={
          <>
            The <em className="italic text-rust">best</em> memory care
            in California,{" "}
            <span
              className="px-1"
              style={{ backgroundImage: "linear-gradient(transparent 70%, var(--color-gold-soft) 70%)" }}
            >
              ranked by the state&rsquo;s own inspectors.
            </span>
          </>
        }
        subtitle="No paid ads. No sales calls. Every claim sourced and dated to a public state record."
        illustrationSrc="/illustrations/family.png"
        illustrationAlt="Illustrated family walking together — representing the families we help navigate memory care decisions"
        liveLabel={
          counties.length > 0 ? `Live across ${counties.length} CA counties` : "Live across CA"
        }
      />

      <StateHubStats
        label="§ 01 · The Public Record"
        title={<>The California facility data you need, <em>curated + analyzed for you.</em></>}
        stats={statItems}
      />

      <StateHubMethodology
        sectionLabel="§ 02 · The Record"
        sectionTitle={<>Five data signals. <em>Compared to peers.</em></>}
        explainerTitle="Data you can trace to a citation number."
        explainerBody={
          <>
            <p className="mb-4">
              Each facility shows its inspection record for the past five years directly from California CDSS — every citation, severity level, and repeat violation. We compare each facility against hundreds of similar California facilities so you can see what&apos;s normal and what stands out.
            </p>
          </>
        }
        methodologyHref="/methodology"
        steps={CALIFORNIA_METHODOLOGY_STEPS}
      />

      <StateHubBrowse
        sectionLabel="§ 03 · Browse California"
        sectionTitle={<>Start with your county, <em>or jump to your city.</em></>}
        stateSlug="california"
        browseSectionTitle={`By county · ${counties.length} live`}
        counties={counties}
        comingCounties={COMING_COUNTIES}
        popularCitiesTitle="Popular cities · By facility count"
        topCities={topCities}
        viewAllHref="/california"
        viewAllLabel="View all California counties →"
      />

      <StateHubEditorial
        sectionLabel="§ 04 · The Reports"
        sectionTitle={<>An editorial desk for memory care, <em>backed by primary-source data.</em></>}
        cards={CALIFORNIA_EDITORIAL_CARDS}
        year={year}
      />

      <StateHubReviews reviews={sampleReviews} />

      <StateHubFaq faqs={CA_FAQS} />

      <StateHubCta facilityCount={stats.facilities} ctaHref="/california" />
    </>
  );
}
