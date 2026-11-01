import Link from "next/link";
import type { ReactNode } from "react";
import { ArticleFaq } from "@/components/articles/ArticleFaq";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { loadInspectionWindow, type InspectionWindow } from "@/lib/data/inspectionWindow";
import { formatRecordDate, loadStateMemoryCareStats } from "@/lib/data/stateMemoryCareStats";
import { SERIOUS_COUNT_SENTENCE, SERIOUS_PROFILE_TAGS } from "@/lib/content/seriousCitationTerms";
import { isArticleApproved } from "@/lib/content/articleReview";
import { PENNSYLVANIA_DESIGNATION } from "@/lib/content/designationArticles";
import { HOW_TO_CHECK, type HowToState } from "@/lib/content/howToCheckArticles";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

const prose = "text-[17px] leading-relaxed text-ink-2";
const linkCls = "text-teal underline-offset-2 hover:underline";

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={linkCls} rel="noopener noreferrer">
      {children}
    </a>
  );
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

const STEPS: Record<HowToState, ReactNode> = {
  AZ: (
    <>
      <p className={prose}>
        Open{" "}
        <External href="https://azcarecheck.azdhs.gov">AZ Care Check</External> and search the home&apos;s name. The inspection record on that site is the original. This directory&apos;s page for the home links to it when we stored a link.
      </p>
      <p className={`mt-4 ${prose}`}>
        A Directed Care license is Arizona&apos;s authorization for memory care. ADHS told us in a June 2026 public records response that homes licensed for directed care services are automatically authorized for memory care services. The license level is not an inspection result. Read{" "}
        <Link href="/arizona/memory-care-licensing" className={linkCls}>how Arizona licenses memory care</Link>.
      </p>
    </>
  ),
  CA: (
    <>
      <p className={prose}>
        Open the{" "}
        <External href="https://www.ccld.dss.ca.gov/carefacilitysearch/">CDSS care facility search</External> and search the home&apos;s name or facility number. The record on that site is the original. This directory&apos;s page for the home links to it when we stored a link.
      </p>
      <p className={`mt-4 ${prose}`}>
        CDSS says the search holds five years of facility information. For older records, or more detail on a citation, call the regional office listed on the facility&apos;s page. CDSS also says a home must show you its current licensing information when you ask.
      </p>
      <p className={`mt-4 ${prose}`}>
        <External href="https://california.public.law/codes/health_and_safety_code_section_1569.33">Health and Safety Code § 1569.33</External> has required an annual unannounced inspection of every residential care facility for the elderly since January 1, 2019. The home must fix a deficiency within 10 days of notice, unless the plan of correction sets a different date.
      </p>
      <p className={`mt-4 ${prose}`}>
        Type A and Type B are explained in{" "}
        <Link href="/library/type-a-vs-type-b-deficiencies-explained" className={linkCls}>Type A vs. Type B deficiencies</Link>.
      </p>
    </>
  ),
  PA: (
    <>
      <p className={prose}>
        Open the{" "}
        <External href="https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/">Pennsylvania human services provider directory</External> and search the home&apos;s name. The office is the Department of Human Services, not the Department of Health. This directory&apos;s page for the home links to the record when we stored a link.
      </p>
      <p className={`mt-4 ${prose}`}>
        Choose the Office of Long-Term Living as the program office, and type at least four characters of the home&apos;s name. DHS says the directory refreshes daily. Personal care homes follow 55 Pa. Code Chapter 2600. Assisted living residences follow Chapter 2800.
      </p>
    </>
  ),
  OR: (
    <>
      <p className={prose}>
        Search the home&apos;s name on the{" "}
        <External href="https://ltclicensing.oregon.gov">Oregon long-term care licensing site</External> and open its survey record. The record on that site is the original. This directory&apos;s page for the home links to it when we stored a link.
      </p>
      <p className={`mt-4 ${prose}`}>
        DHS says the site updates every 24 hours, and that complaints still under investigation or findings under appeal are not shown. Assisted living and residential care facilities are surveyed every 24 months. An endorsed memory care unit is surveyed on its facility&apos;s schedule.
      </p>
      <p className={`mt-4 ${prose}`}>
        A memory care endorsement is permission to advertise memory care. It is not an inspection result. That is explained in{" "}
        <Link href="/oregon/memory-care-licensing" className={linkCls}>how Oregon licenses memory care</Link>.
      </p>
    </>
  ),
  IL: (
    <>
      <p className={prose}>
        Search the home&apos;s name on the{" "}
        <External href="https://llcs.dph.illinois.gov/s/facility-lookup?language=en_US">Illinois Department of Public Health facility lookup</External> and open its record. This directory&apos;s page for the home lists the inspections we hold.
      </p>
      <p className={`mt-4 ${prose}`}>
        Assisted living establishments follow 77 Ill. Adm. Code 295. When a citation names a rule, that names the rule. It does not describe what the inspector saw. A rule about a dementia program is not a designation that the home provides memory care.
      </p>
      <p className={`mt-4 ${prose}`}>
        The license names are in{" "}
        <Link href="/illinois/memory-care-licensing" className={linkCls}>how Illinois licenses memory care</Link>.
      </p>
    </>
  ),
  MN: (
    <>
      <p className={prose}>
        Search the home in the{" "}
        <External href="https://www.health.state.mn.us/facilities/providers/index.html">Minnesota Department of Health provider directory</External> and open its inspection record. The record on that site is the original. This directory&apos;s page for the home links to it when we stored a link.
      </p>
      <p className={`mt-4 ${prose}`}>
        Licensing for assisted living with dementia care is explained in{" "}
        <Link href="/minnesota/memory-care-licensing" className={linkCls}>how Minnesota licenses memory care</Link>.
      </p>
    </>
  ),
  WA: (
    <>
      <p className={prose}>
        Search by location or facility name on the{" "}
        <External href="https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx">DSHS assisted living facility locator</External>, then open the home&apos;s ALF Reports page. This directory&apos;s page for the home links to the report we stored.
      </p>
      <p className={`mt-4 ${prose}`}>
        DSHS sorts that page into four kinds of report. Inspections happen at least every 18 months. Investigations follow reported concerns. Enforcement letters summarize action DSHS took to bring the home back into compliance. Fire inspections are done by the State Fire Marshal at initial licensing, after a complaint, or each year.
      </p>
      <p className={`mt-4 ${prose}`}>
        DSHS may black out information that is confidential or could identify a resident. Posting times vary.
      </p>
      <p className={`mt-4 ${prose}`}>
        A dementia-care contract is not a quality badge. That is explained in{" "}
        <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className={linkCls}>why a DSHS contract is not a quality badge</Link>.
      </p>
    </>
  ),
};

const TAG_NOTES: Record<HowToState, string> = {
  AZ: "On an Arizona profile, the red tag is immediate jeopardy. High risk and enforcement are not that label. The count of homes with a serious citation still includes a finding stored at severity 3 or higher.",
  CA: SERIOUS_PROFILE_TAGS.CA.note,
  OR: SERIOUS_PROFILE_TAGS.OR.note,
  IL: `${SERIOUS_PROFILE_TAGS.IL.note} A Type 1 citation is not a memory care designation.`,
  MN: `${SERIOUS_PROFILE_TAGS.MN.note} The count of homes with a serious citation still includes a finding stored at severity 3 or higher.`,
  PA: "On a Pennsylvania profile, immediate jeopardy, revocation, substantiated abuse, and a provisional license are red tags. A civil money penalty is not a red tag.",
  WA: "On a Washington assisted living profile, the red tag is immediate jeopardy. The count of homes with a serious citation still includes a finding stored at severity 3 or higher.",
};

const h2 = "mt-12 font-[family-name:var(--font-display)] text-2xl text-navy";

function WindowSentences({ held, stateName }: { held: InspectionWindow; stateName: string }) {
  const cutoff = formatRecordDate(held.cutoff);
  const oldest = formatRecordDate(held.oldest);
  return (
    <>
      <p className={`mt-4 ${prose}`}>
        {`Since ${cutoff}, we hold ${formatCount(held.inspections)} inspections of published ${stateName} homes.`}
        {held.complaintFlagged
          ? ` ${formatCount(held.complaintInspections)} of them followed a complaint.`
          : ` The ${stateName} files we hold do not mark which inspections followed a complaint.`}
      </p>
      {oldest ? (
        <p className={`mt-4 ${prose}`}>{`The oldest ${stateName} inspection we hold is dated ${oldest}.`}</p>
      ) : null}
    </>
  );
}

export async function HowToCheckBody({ code }: { code: HowToState }) {
  const article = HOW_TO_CHECK[code];
  const showPennsylvaniaDesignation =
    code === "PA" && (await isArticleApproved(PENNSYLVANIA_DESIGNATION.path));
  const supabase = tryPublicSupabaseClient();
  const [stats, held] = supabase
    ? await Promise.all([loadStateMemoryCareStats(supabase), loadInspectionWindow(supabase, code)])
    : [null, null];
  const row = stats?.rows.find((item) => item.code === code) ?? null;
  const newest = row ? formatRecordDate(row.newestInspection) : null;

  return (
    <>
      <p className={prose}>{article.answer}</p>
      <h2 className={h2}>Where is the official record?</h2>
      <div className="mt-4">{STEPS[code]}</div>
      {showPennsylvaniaDesignation ? (
        <p className={`mt-4 ${prose}`}>
          The two license names for dementia care are on{" "}
          <Link href={PENNSYLVANIA_DESIGNATION.path} className={linkCls}>
            is this home licensed for memory care
          </Link>
          .
        </p>
      ) : null}
      <p className={`mt-4 ${prose}`}>
        <Link href={article.facilitiesPath} className={linkCls}>
          Browse {article.stateName} homes
        </Link>
        .
      </p>
      <h2 className={h2}>What should I read in a report?</h2>
      <ul className={`mt-4 list-disc space-y-2 pl-6 ${prose}`}>
        <li>The date. A finding from last month says more about the home today than one from three years ago.</li>
        <li>Whether the visit followed a complaint, or was a routine inspection.</li>
        <li>The rule cited and the inspector&apos;s description of what happened. Read the text, not only the code.</li>
        <li>The severity label the state used. The next section says what that label means on a profile here.</li>
        <li>Whether a later inspection found the same problem again.</li>
      </ul>
      <h2 className={h2}>What does the red tag mean on a StarlynnCare profile?</h2>
      <p className={`mt-4 ${prose}`}>{TAG_NOTES[code]}</p>
      <p className={`mt-4 ${prose}`}>{SERIOUS_COUNT_SENTENCE}</p>
      <p className={`mt-4 ${prose}`}>
        The profile lists inspections from the last 3 years. Findings older than that can remain in the record we hold.
      </p>
      <h2 className={h2}>What records do we hold for {article.stateName}?</h2>
      {row ? (
        <>
          <p className={`mt-4 ${prose}`}>
            {row.withInspection === row.published
              ? `All ${formatCount(row.published)} published ${article.stateName} homes have an inspection on file.`
              : `${formatCount(row.withInspection)} of ${formatCount(row.published)} published ${article.stateName} homes have an inspection on file.`}
            {newest ? ` The newest inspection date we hold is ${newest}.` : ""}
          </p>
          <p className={`mt-4 ${prose}`}>
            {formatCount(row.seriousHomes)} of those published homes have a serious citation in the last 24 months.
          </p>
          {held ? <WindowSentences held={held} stateName={article.stateName} /> : null}
          <DataFootnote source={row.regulatorLong} note="Same rule as /data. The serious figure counts homes, not findings." />
        </>
      ) : (
        <p className={`mt-4 ${prose}`}>The state counts could not be loaded.</p>
      )}
      <h2 className={h2}>What should I ask the home?</h2>
      <ul className={`mt-4 list-disc space-y-2 pl-6 ${prose}`}>
        <li>Ask about each finding from the last 24 months, and what the home changed afterward.</li>
        <li>Ask whether any complaint investigation is still open.</li>
        <li>Ask to see the most recent inspection report the home received.</li>
      </ul>
      <ArticleFaq items={article.faq} />
    </>
  );
}

export function ArizonaHowToCheckBody() {
  return <HowToCheckBody code="AZ" />;
}

export function CaliforniaHowToCheckBody() {
  return <HowToCheckBody code="CA" />;
}

export function PennsylvaniaHowToCheckBody() {
  return <HowToCheckBody code="PA" />;
}

export function WashingtonHowToCheckBody() {
  return <HowToCheckBody code="WA" />;
}

export function OregonHowToCheckBody() {
  return <HowToCheckBody code="OR" />;
}

export function IllinoisHowToCheckBody() {
  return <HowToCheckBody code="IL" />;
}

export function MinnesotaHowToCheckBody() {
  return <HowToCheckBody code="MN" />;
}
