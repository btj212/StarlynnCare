import Link from "next/link";
import type { ReactNode } from "react";
import { isArticleApproved } from "@/lib/content/articleReview";
import { SERIOUS_COUNT_SENTENCE } from "@/lib/content/seriousCitationTerms";

const prose = "text-[17px] leading-relaxed text-ink-2";
const linkCls = "text-teal underline-offset-2 hover:underline";
const REPORT_PATH = "/research/memory-care-serious-citations-by-state";

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={linkCls} rel="noopener noreferrer">
      {children}
    </a>
  );
}

const STATES: Array<{ name: string; hub: string; body: ReactNode }> = [
  {
    name: "California",
    hub: "/california",
    body: (
      <>
        On a California profile, the red tag is Type A or immediate jeopardy. Type B is not that tag.{" "}
        <Link href="/library/type-a-vs-type-b-deficiencies-explained" className={linkCls}>
          Type A vs. Type B
        </Link>{" "}
        explains the two classes.
      </>
    ),
  },
  {
    name: "Illinois",
    hub: "/illinois",
    body: (
      <>
        On an Illinois profile, the red tag is Type 1. Type 2 and Type 3 are not. Illinois classifies these violations under{" "}
        <External href="https://www.ilga.gov/agencies/JCAR/Sections?PartID=07700295">77 Ill. Adm. Code Part 295</External>.
      </>
    ),
  },
  {
    name: "Pennsylvania",
    hub: "/pennsylvania",
    body: (
      <>
        On a Pennsylvania profile, immediate jeopardy, revocation, substantiated abuse, and a provisional license are red tags. A civil money penalty is not a red tag. Personal care homes follow 55 Pa. Code Chapter 2600. Assisted living residences follow Chapter 2800. The office is the Department of Human Services, not the Department of Health.
      </>
    ),
  },
  {
    name: "Arizona",
    hub: "/arizona",
    body: (
      <>
        On an Arizona profile, the red tag is immediate jeopardy. High risk and enforcement are not that label. The count of homes with a serious citation still includes a finding stored at severity 3 or higher. Inspections are published on{" "}
        <External href="https://azcarecheck.azdhs.gov">AZ Care Check</External>. The licensing rules are A.A.C. Title 9, Chapter 10.
      </>
    ),
  },
  {
    name: "Oregon",
    hub: "/oregon",
    body: (
      <>
        On an Oregon profile, level 4 is labeled IJ. Level 3 is not. This count still includes severity 3. Assisted living surveys are under OAR 411-054. The license lookup is the{" "}
        <External href="https://ltclicensing.oregon.gov/">Oregon long-term care licensing site</External>.
      </>
    ),
  },
  {
    name: "Washington",
    hub: "/washington",
    body: (
      <>
        On a Washington assisted living profile, the red tag is immediate jeopardy. On a nursing-home profile, scope-and-severity rows J through L are also labeled IJ. The count of homes with a serious citation still includes a finding stored at severity 3 or higher.
      </>
    ),
  },
  {
    name: "Minnesota",
    hub: "/minnesota",
    body: (
      <>
        On a Minnesota profile, the red tag is an immediate-jeopardy flag. Other inspection text is shown as written.
      </>
    ),
  },
  {
    name: "Missouri",
    hub: "/missouri",
    body: (
      <>
        On a Missouri profile, the red tag is an immediate-jeopardy flag. A finding stored at severity 4 without that flag is labeled Complaint or High Risk, not IJ. Citations use 19 CSR tags. The lookup is the{" "}
        <External href="https://healthapps.dhss.mo.gov/showmeltc/">DHSS long-term care search</External>.
      </>
    ),
  },
  {
    name: "Texas",
    hub: "/texas",
    body: (
      <>
        On a Texas profile, an immediate-jeopardy flag is labeled IJ. Other words on the inspection are shown as written.
      </>
    ),
  },
  {
    name: "Utah",
    hub: "/utah",
    body: (
      <>
        Utah does not publish a numerical severity scale. On a profile, immediate jeopardy, a suspension, or a revocation is labeled IJ. A finding stored at severity 3 is labeled Serious, not IJ. This count still includes severity 3. The license office is the Division of Licensing and Background Checks (DLBC), inside the Department of Health and Human Services.
      </>
    ),
  },
];

export async function SeriousCitationExplainer() {
  const showReport = await isArticleApproved(REPORT_PATH);
  return (
    <>
      <p className={prose}>
        &ldquo;Serious&rdquo; is not one legal term. Each state writes its own top label on an inspection, and the red tag on a profile uses that label.
      </p>
      <p className={`mt-4 ${prose}`}>{SERIOUS_COUNT_SENTENCE}</p>
      <p className={`mt-4 ${prose}`}>
        On a facility profile, the red tag can be narrower than this count. The note under each state says what that profile calls its top tag.
      </p>
      {STATES.map((state) => (
        <section key={state.name}>
          <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">
            <Link href={state.hub} className="text-navy underline-offset-2 hover:underline">
              {state.name}
            </Link>
          </h2>
          <p className={`mt-4 ${prose}`}>{state.body}</p>
        </section>
      ))}
      {showReport ? (
        <p className={`mt-10 ${prose}`}>
          The count of homes, by state, is on{" "}
          <Link href={REPORT_PATH} className={linkCls}>
            serious citations at memory care homes, by state
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}
