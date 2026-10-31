import Link from "next/link";
import type { ReactNode } from "react";
import { DataFootnote } from "@/components/editorial/DataFootnote";
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
        A Directed Care license is Arizona&apos;s authorization for memory care. It is not an inspection result. Read{" "}
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
    </>
  ),
  WA: (
    <>
      <p className={prose}>
        Search the home&apos;s name or license number on the{" "}
        <External href="https://fortress.wa.gov/dshs/adsaapps/lookup/BHPubLookup.aspx">DSHS provider lookup</External>. Inspection reports for an assisted living facility are on the{" "}
        <External href="https://fortress.wa.gov/dshs/adsaapps/lookup/AlfPubLookup.aspx">ALF reports lookup</External>. This directory&apos;s page for the home links to the report we stored.
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
  PA: "On a Pennsylvania profile, immediate jeopardy, revocation, substantiated abuse, and a provisional license are red tags. A civil money penalty is not a red tag.",
  WA: "On a Washington assisted living profile, the red tag is immediate jeopardy. The count of homes with a serious citation still includes a finding stored at severity 3 or higher.",
};

export async function HowToCheckBody({ code }: { code: HowToState }) {
  const article = HOW_TO_CHECK[code];
  const showPennsylvaniaDesignation =
    code === "PA" && (await isArticleApproved(PENNSYLVANIA_DESIGNATION.path));
  const supabase = tryPublicSupabaseClient();
  const stats = supabase ? await loadStateMemoryCareStats(supabase) : null;
  const row = stats?.rows.find((item) => item.code === code) ?? null;
  const newest = row ? formatRecordDate(row.newestInspection) : null;

  return (
    <>
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">Where to look</h2>
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
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">What the red tag means</h2>
      <p className={`mt-4 ${prose}`}>{TAG_NOTES[code]}</p>
      <p className={`mt-4 ${prose}`}>{SERIOUS_COUNT_SENTENCE}</p>
      <p className={`mt-4 ${prose}`}>
        The profile lists inspections from the last 3 years. Findings older than that can remain in the record we hold.
      </p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">What we hold</h2>
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
          <DataFootnote source={row.regulatorLong} note="Same rule as /data. The figure counts homes, not findings." />
        </>
      ) : (
        <p className={`mt-4 ${prose}`}>The state counts could not be loaded.</p>
      )}
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
