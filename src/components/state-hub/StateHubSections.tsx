import { getSeasonAndYear } from "@/lib/data/stateHub";
import type { StateHubData } from "@/lib/data/stateHub";
import type { StateHubConfig } from "@/lib/stateHubConfigs/types";
import { buildStateStatItems, buildStateStatFootnotes } from "@/lib/stateHubConfigs/types";
import { StateHubHero } from "./StateHubHero";
import { StateHubStats } from "./StateHubStats";
import { StateHubMethodology } from "./StateHubMethodology";
import { StateHubBrowse } from "./StateHubBrowse";
import { StateHubEditorial } from "./StateHubEditorial";
import { StateHubReviews } from "./StateHubReviews";
import { StateHubFaq } from "./StateHubFaq";
import { StateHubCta } from "./StateHubCta";

type Props = {
  data: StateHubData;
  config: StateHubConfig;
};

export function StateHubSections({ data, config }: Props) {
  const { year } = getSeasonAndYear();
  const { stateSlug, stateName, stateCode } = config;
  const statItems = buildStateStatItems(data.stats, config);
  const statFootnotes = buildStateStatFootnotes(data.stats, config);
  const { counties, topCities, stats, sampleReviews } = data;

  const countyCode = stateCode;

  return (
    <>
      <StateHubHero
        title={
          <>
            The <em className="italic text-rust">best</em> memory care
            in {stateName},{" "}
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
        illustrationAlt={`Illustrated family walking together — representing the families we help navigate memory care decisions in ${stateName}`}
        liveLabel={
          counties.length > 0 ? `Live across ${counties.length} ${countyCode} counties` : `Live across ${stateName}`
        }
        roadmapNote=""
      />

      <StateHubStats
        title={<>The {stateName} facility data you need, <em>curated + analyzed for you.</em></>}
        stats={statItems}
        footnotes={statFootnotes}
      />

      <StateHubMethodology
        sectionTitle={<>Three data signals. <em>Compared to peers.</em></>}
        explainerTitle="Data you can trace to a citation number."
        explainerBody={
          <>
            <p className="mb-4">
              Each facility shows its inspection record directly from {stateName}&rsquo;s regulator — every citation, severity level,
              and repeat violation. We compare each facility against similar {stateName} facilities so you can see what&rsquo;s normal
              and what stands out.
            </p>
          </>
        }
        methodologyHref="/methodology"
        steps={config.methodologySteps}
      />

      <StateHubBrowse
        sectionTitle={<>Start with your county, <em>or jump to your city.</em></>}
        stateSlug={stateSlug}
        browseSectionTitle={`By county · ${counties.length} live`}
        counties={counties}
        comingCounties={config.comingCounties}
        popularCitiesTitle="Popular cities · By facility count"
        topCities={topCities}
        viewAllHref={`/${stateSlug}`}
        viewAllLabel={`View all ${stateName} counties →`}
      />

      <StateHubEditorial
        sectionTitle={<>An editorial desk for memory care, <em>backed by primary-source data.</em></>}
        cards={config.editorialCards}
        year={year}
        stateName={config.stateName}
      />

      <StateHubReviews reviews={sampleReviews} />

      <StateHubFaq faqs={config.faqs} />

      <StateHubCta facilityCount={stats.facilities} ctaHref={`/${stateSlug}`} />
    </>
  );
}
