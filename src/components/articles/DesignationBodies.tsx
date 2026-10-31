import Link from "next/link";
import type { ReactNode } from "react";
import { ArticleFaq } from "@/components/articles/ArticleFaq";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import {
  MISSOURI_DESIGNATION,
  OREGON_DESIGNATION,
  PENNSYLVANIA_DESIGNATION,
} from "@/lib/content/designationArticles";
import { loadDesignationCounts, type DesignationSnapshot, type DesignationState } from "@/lib/data/designationCounts";
import { regulatorFor } from "@/lib/states/regulators";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

const prose = "text-[17px] leading-relaxed text-ink-2";
const linkCls = "text-teal underline-offset-2 hover:underline";

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function RuleLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={linkCls} rel="noopener noreferrer">
      {children}
    </a>
  );
}

function CountBlock({
  snapshot,
  source,
  sentence,
}: {
  snapshot: DesignationSnapshot | null;
  source: string;
  sentence: (snapshot: DesignationSnapshot) => ReactNode;
}) {
  if (!snapshot) {
    return <p className={`mt-4 ${prose}`}>The designation counts could not be loaded.</p>;
  }
  return (
    <>
      <p className={`mt-4 ${prose}`}>{sentence(snapshot)}</p>
      <DataFootnote source={source} note="Publishable homes. A name match is not counted." />
    </>
  );
}

async function load(state: DesignationState): Promise<DesignationSnapshot | null> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;
  return loadDesignationCounts(supabase, state);
}

function missingCount(): ReactNode {
  return "This count could not be loaded.";
}

const h2 = "mt-12 font-[family-name:var(--font-display)] text-2xl text-navy";

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className={`mt-4 list-disc space-y-2 pl-6 ${prose}`}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export async function OregonDesignationBody() {
  const snapshot = await load("OR");
  const office = regulatorFor("OR");
  return (
    <>
      <p className={prose}>
        Check the license. Oregon DHS records a memory care endorsement on the license of a residential care, assisted living, or nursing facility that runs a memory care community. A home may not advertise itself as a memory care community until Oregon DHS has granted a memory care endorsement.
      </p>
      <h2 className={h2}>What does the Oregon rule say?</h2>
      <p className={`mt-4 ${prose}`}>
        <RuleLink href="https://oregon.public.law/statutes/ors_443.886">ORS 443.886</RuleLink> says a facility may not advertise or market itself as an Alzheimer&apos;s care unit or memory care community unless it has the endorsement.
      </p>
      <p className={`mt-4 ${prose}`}>
        <RuleLink href="https://oregon.public.law/rules/oar_411-057-0130">OAR 411-057-0130</RuleLink> says an applicant may not advertise as a memory care community until the Department has granted the endorsement. A home with the endorsement may say that it has one. The advertising may not say the Department recommends that home.
      </p>
      <p className={`mt-4 ${prose}`}>
        The endorsement is recorded on the facility license. It is not a quality score.
      </p>
      <p className={`mt-4 ${prose}`}>
        Under{" "}
        <RuleLink href="https://www.oregon.gov/odhs/rules-policy/apdrules/411-057.pdf">OAR 411-057-0120</RuleLink>, a home applies on form APD 940 at least 60 days before it wants the endorsement. DHS inspects the unit on site before it issues the endorsement, and the endorsement is renewed with the facility license. The application fee is $50, $75, or $100, depending on how many memory care residents the unit holds.
      </p>
      <h2 className={h2}>What does an endorsed home have to do?</h2>
      <p className={`mt-4 ${prose}`}>
        These come from OAR chapter 411, division 057. Sections 0140 and 0170 are temporary rules in effect from August 11 to December 27, 2026.
      </p>
      <Bullets
        items={[
          "Every staff member completes dementia care training before giving care alone. Direct care staff in assisted living and residential care complete 16 hours of in-service training each year, which can include the six hours of yearly dementia training (0155).",
          "At least 10 hours of the administrator's yearly continuing education must relate to dementia care (0140).",
          "Staffing must meet residents' scheduled and unscheduled needs. Night staffing is set by residents' sleep patterns and needs (0150).",
          "The unit is on the ground level of the building, unless DHS grants an exception. Units built or remodeled under plans approved on or after November 1, 2010 need a secured outdoor area of at least 600 square feet, or 15 square feet per resident if that is larger (0170).",
          "The home gives its memory care uniform disclosure statement to anyone who asks about the unit (0140).",
          "If a resident leaves the secured unit without staff knowing, the home calls 911 or local police after a first search. It notifies DHS, the Long-Term Care Ombudsman, and the resident's representative within 24 hours (0140).",
        ]}
      />
      <h2 className={h2}>How many Oregon homes have the endorsement?</h2>
      <CountBlock
        snapshot={snapshot}
        source={office?.long ?? "Oregon DHS"}
        sentence={(row) =>
          row.endorsed == null || row.published == null
            ? missingCount()
            : `Oregon DHS lists a memory care endorsement on ${formatCount(row.endorsed)} of ${formatCount(row.published)} published homes in this directory.`
        }
      />
      <h2 className={h2}>How do I check one Oregon home?</h2>
      <p className={`mt-4 ${prose}`}>
        Search the home&apos;s name on the{" "}
        <RuleLink href="https://ltclicensing.oregon.gov/">Oregon long-term care licensing site</RuleLink> and look for the endorsement on the license. This directory&apos;s page for the home links to that record when we have one.
      </p>
      <p className={`mt-4 ${prose}`}>
        The same record shows routine inspections, inspections after a complaint, substantiated violations, and regulatory actions.{" "}
        <RuleLink href="https://ltclicensing.oregon.gov/Home/About">DHS says</RuleLink> the site updates every 24 hours, and complaints still under investigation or findings under appeal are not shown. Assisted living and residential care facilities are surveyed every 24 months, and an endorsed unit is surveyed on its facility&apos;s schedule.
      </p>
      <h2 className={h2}>What should I ask an Oregon home?</h2>
      <Bullets
        items={[
          "Ask for the memory care uniform disclosure statement before you sign.",
          "Ask how staff search for a resident who leaves the unit, and who they call.",
          "Ask how many hours of dementia training direct care staff completed this year.",
          "Ask to see the secured outdoor area.",
        ]}
      />
      <p className={`mt-4 ${prose}`}>
        <Link href="/oregon/facilities" className={linkCls}>Browse Oregon homes</Link>
        {" "}or read{" "}
        <Link href="/oregon/memory-care-licensing" className={linkCls}>how Oregon licenses memory care</Link>.
      </p>
      <p className={`mt-4 ${prose}`}>
        Washington&apos;s dementia-care contract is a different designation, and{" "}
        <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className={linkCls}>it is not a quality badge</Link>.
      </p>
      <ArticleFaq items={OREGON_DESIGNATION.faq} />
    </>
  );
}

export async function PennsylvaniaDesignationBody() {
  const snapshot = await load("PA");
  const office = regulatorFor("PA");
  return (
    <>
      <p className={prose}>
        Look for one of two Department of Human Services designations. A personal care home can have a secured dementia care unit. An assisted living residence can have a special care unit. DHS inspects and approves either unit before it opens.
      </p>
      <h2 className={h2}>What do the Pennsylvania rules say?</h2>
      <p className={`mt-4 ${prose}`}>
        On a personal care home, a secured dementia care unit is a home, or part of a home, that provides specialized care for residents with Alzheimer&apos;s disease or other dementia. That definition is in{" "}
        <RuleLink href="https://www.pacodeandbulletin.gov/secure/pacode/data/055/chapter2600/s2600.231.html">55 Pa. Code § 2600.231</RuleLink>.
      </p>
      <p className={`mt-4 ${prose}`}>
        On an assisted living residence, a special care unit is a residence, or part of a residence, that provides specialized care for residents with Alzheimer&apos;s disease or dementia. That definition is in{" "}
        <RuleLink href="https://www.pacodeandbulletin.gov/secure/pacode/data/055/chapter2800/s2800.231.html">55 Pa. Code § 2800.231</RuleLink>. The same chapter also covers a special care unit for intense neurobehavioral rehabilitation. The state file we hold labels this designation Special Care and does not split those two uses.
      </p>
      <p className={`mt-4 ${prose}`}>
        A home must apply to DHS at least 60 days before it opens a unit, adds one, raises its capacity, or changes its locks, exit doors, or floor plan (
        <RuleLink href="https://www.pacodeandbulletin.gov/secure/pacode/data/055/chapter2600/s2600.239.html">§ 2600.239</RuleLink> and{" "}
        <RuleLink href="https://www.pacodeandbulletin.gov/secure/pacode/data/055/chapter2800/s2800.239.html">§ 2800.239</RuleLink>). The filing includes the locking system, the policy for emergency exits and residents who leave, a sample two-week staffing schedule, proof of the extra training, and floor plans. DHS inspects and approves the unit before it operates or changes.
      </p>
      <h2 className={h2}>What does a secured dementia care unit have to do?</h2>
      <p className={`mt-4 ${prose}`}>
        These are the personal care home rules in Chapter 2600. Chapter 2800 sets its own rules for special care units, starting at § 2800.231.
      </p>
      <Bullets
        items={[
          "A physician, physician assistant, or certified registered nurse practitioner documents the dementia diagnosis and the need for the unit within 60 days before admission (§ 2600.231).",
          "A written cognitive preadmission screening is completed within 72 hours before admission.",
          "The resident record shows that the resident and the designated person did not object to the move into the unit.",
          "The resident is assessed each year for whether the unit is still needed.",
          "The contract discloses services, admission and discharge criteria, change-in-condition policies, special programming, and costs and fees.",
          <>
            Locked exit doors need written approval from the Department of Labor and Industry, the Department of Health, or the local building authority. The locks must release on a fire alarm, a power failure, or a keypad override, and the fire alarm connects to the fire department or a 24-hour monitoring service (
            <RuleLink href="https://www.pacodeandbulletin.gov/secure/pacode/data/055/chapter2600/s2600.233.html">§ 2600.233</RuleLink>).
          </>,
        ]}
      />
      <h2 className={h2}>How many Pennsylvania homes have each designation?</h2>
      <CountBlock
        snapshot={snapshot}
        source={office?.long ?? "Pennsylvania DHS"}
        sentence={(row) => {
          if (row.secureDementiaCareUnit == null || row.specialCare == null || row.published == null) {
            return missingCount();
          }
          return `Pennsylvania DHS lists ${formatCount(row.secureDementiaCareUnit)} published homes as a secure dementia care unit and ${formatCount(row.specialCare)} as special care, out of ${formatCount(row.published)} published homes.`;
        }}
      />
      <h2 className={h2}>How do I check one Pennsylvania home?</h2>
      <p className={`mt-4 ${prose}`}>
        Search the home in the{" "}
        <RuleLink href="https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/">Pennsylvania human services provider directory</RuleLink>. Then open the home&apos;s page in this directory.
      </p>
      <p className={`mt-4 ${prose}`}>
        Choose the Office of Long-Term Living as the program office, and type at least four characters of the home&apos;s name. DHS says the directory refreshes daily.
      </p>
      <h2 className={h2}>What should I ask a Pennsylvania home?</h2>
      <Bullets
        items={[
          "Ask which license the home holds, and whether your family member would live in the secured or special care unit.",
          "Ask for the contract's section on services, discharge criteria, and fees before you sign.",
          "Ask when your family member would be reassessed for the unit.",
          "Ask what happens to the door locks when the fire alarm sounds or the power fails.",
        ]}
      />
      <p className={`mt-4 ${prose}`}>
        <Link href="/pennsylvania/facilities" className={linkCls}>Browse Pennsylvania homes</Link>
        {" "}or read{" "}
        <Link href="/pennsylvania/memory-care-licensing" className={linkCls}>how Pennsylvania licenses memory care</Link>.
      </p>
      <p className={`mt-4 ${prose}`}>
        Washington&apos;s dementia-care contract is a different designation, and{" "}
        <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className={linkCls}>it is not a quality badge</Link>.
      </p>
      <ArticleFaq items={PENNSYLVANIA_DESIGNATION.faq} />
    </>
  );
}

export async function MissouriDesignationBody() {
  const snapshot = await load("MO");
  const office = regulatorFor("MO");
  return (
    <>
      <p className={prose}>
        Missouri has no standalone memory care license. Check for one of two filings instead. A home that offers an Alzheimer&apos;s special care unit or program must file a disclosure with the state. An assisted living facility that keeps residents who cannot evacuate on their own holds a license the state file marks ALF**.
      </p>
      <h2 className={h2}>What do the Missouri statutes say?</h2>
      <p className={`mt-4 ${prose}`}>
        <RuleLink href="https://revisor.mo.gov/main/OneSection.aspx?section=198.510">Section 198.510</RuleLink> requires a facility that offers an Alzheimer&apos;s special care unit or program to file a disclosure with the department that licenses it. The disclosure says how that unit&apos;s care differs from the rest of the facility. The department checks the disclosure when the license is renewed.
      </p>
      <p className={`mt-4 ${prose}`}>
        <RuleLink href="https://revisor.mo.gov/main/OneSection.aspx?section=198.073">Section 198.073.6</RuleLink> applies when an assisted living facility keeps a resident who cannot safely evacuate with minimal assistance. The facility must keep enough staff awake at all hours to help with evacuation, and put an evacuation plan in that resident&apos;s service plan. The state file marks that license ALF**. It is not the same filing as the special care unit disclosure.
      </p>
      <p className={`mt-4 ${prose}`}>
        The same section adds two more duties for that resident: a chance to explore the facility and, where appropriate, its grounds, and a personal electronic monitoring device if the resident&apos;s physician recommends one.
      </p>
      <h2 className={h2}>What does the disclosure cover?</h2>
      <p className={`mt-4 ${prose}`}>
        Section 198.510 has the home explain how the unit differs from the rest of the facility in nine areas:
      </p>
      <Bullets
        items={[
          "Its philosophy and mission for residents with dementia.",
          "How residents are placed in, transferred from, or discharged from the unit.",
          "How residents are assessed, and how the plan of care changes with their condition.",
          "Staff training and continuing education.",
          "The physical environment and design.",
          "How often activities happen, and what they are.",
          "How families are involved, and what family support exists.",
          "Costs of care and any added fees.",
          "Safety and security.",
        ]}
      />
      <p className={`mt-4 ${prose}`}>
        The home must give a copy to the resident and the next of kin, designee, or guardian at admission.
      </p>
      <h2 className={h2}>How many Missouri homes have either filing?</h2>
      <CountBlock
        snapshot={snapshot}
        source={office?.long ?? "Missouri DHSS"}
        sentence={(row) => {
          if (row.alzheimerScuDisclosure == null || row.alfStar == null) return missingCount();
          return `Missouri DHSS lists the Alzheimer's special care unit disclosure on ${formatCount(row.alzheimerScuDisclosure)} published homes. It lists the ALF** license on ${formatCount(row.alfStar)} published homes. A home is not in either count because its name says memory care.`;
        }}
      />
      <h2 className={h2}>How do I check one Missouri home?</h2>
      <p className={`mt-4 ${prose}`}>
        Search the home on the{" "}
        <RuleLink href="https://healthapps.dhss.mo.gov/showmeltc/">DHSS long-term care lookup</RuleLink>. Ask the home for the disclosure it filed. The license class shows whether it is ALF**.
      </p>
      <p className={`mt-4 ${prose}`}>
        Every Missouri assisted living facility must also tell a prospective resident what services it can provide, what they cost, and which conditions would require a move (section 198.073.8).
      </p>
      <h2 className={h2}>What should I ask a Missouri home?</h2>
      <Bullets
        items={[
          "Ask for the Alzheimer's special care disclosure the home filed with DHSS.",
          "Ask whether the license is ALF**, and how many staff are awake overnight.",
          "Ask to see the evacuation plan that would go into your family member's service plan.",
          "Ask what services cost, and which changes in condition would require a move.",
        ]}
      />
      <p className={`mt-4 ${prose}`}>
        <Link href="/missouri/facilities" className={linkCls}>Browse Missouri homes</Link>
        {" "}or read{" "}
        <Link href="/missouri/memory-care-licensing" className={linkCls}>how Missouri licenses memory care</Link>.
      </p>
      <p className={`mt-4 ${prose}`}>
        Washington&apos;s dementia-care contract is a different designation, and{" "}
        <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className={linkCls}>it is not a quality badge</Link>.
      </p>
      <ArticleFaq items={MISSOURI_DESIGNATION.faq} />
    </>
  );
}

export async function TexasDesignationBody() {
  const snapshot = await load("TX");
  const office = regulatorFor("TX");
  return (
    <>
      <p className={prose}>
        A Texas assisted living facility that advertises specialized care for people with Alzheimer&apos;s disease or a related disorder must hold an Alzheimer&apos;s certification.
      </p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">The rule</h2>
      <p className={`mt-4 ${prose}`}>
        The rule is{" "}
        <RuleLink href="https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-553-27">26 TAC § 553.27</RuleLink>. The certificate is for a Type B facility, or a unit of a Type B facility. It is valid for three years. The home must post it where the public can see it.
      </p>
      <p className={`mt-4 ${prose}`}>
        Words such as medication reminders or short-term memory loss do not, by themselves, require the certificate.
      </p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">Homes the state file lists</h2>
      <CountBlock
        snapshot={snapshot}
        source={office?.long ?? "Texas HHSC"}
        sentence={(row) =>
          row.alzheimerCertified == null || row.published == null
            ? missingCount()
            : `Texas HHSC lists an Alzheimer certification on ${formatCount(row.alzheimerCertified)} of ${formatCount(row.published)} published homes in this directory.`
        }
      />
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">How to check one home</h2>
      <p className={`mt-4 ${prose}`}>
        Search the home on the{" "}
        <RuleLink href="https://apps.hhs.texas.gov/LTCSearch/">HHSC long-term care search</RuleLink> and look for the posted certificate. This directory&apos;s page for the home says when HHSC lists a certification, including the certificate number when we have one.
      </p>
      <p className={`mt-4 ${prose}`}>
        <Link href="/texas/facilities" className={linkCls}>Browse Texas homes</Link>
        {" "}or read{" "}
        <Link href="/texas/type-a-b-c-licensing" className={linkCls}>how Texas licenses assisted living</Link>.
      </p>
      <p className={`mt-4 ${prose}`}>
        Washington&apos;s dementia-care contract is a different designation, and{" "}
        <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className={linkCls}>it is not a quality badge</Link>.
      </p>
    </>
  );
}
