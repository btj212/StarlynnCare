import Link from "next/link";
import type { ReactNode } from "react";
import { DataFootnote } from "@/components/editorial/DataFootnote";
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

export async function OregonDesignationBody() {
  const snapshot = await load("OR");
  const office = regulatorFor("OR");
  return (
    <>
      <p className={prose}>
        A home may not advertise itself as a memory care community until Oregon DHS has granted a memory care endorsement.
      </p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">The rule</h2>
      <p className={`mt-4 ${prose}`}>
        <RuleLink href="https://oregon.public.law/statutes/ors_443.886">ORS 443.886</RuleLink> says a facility may not advertise or market itself as an Alzheimer&apos;s care unit or memory care community unless it has the endorsement.
      </p>
      <p className={`mt-4 ${prose}`}>
        <RuleLink href="https://oregon.public.law/rules/oar_411-057-0130">OAR 411-057-0130</RuleLink> says an applicant may not advertise as a memory care community until the Department has granted the endorsement. A home with the endorsement may say that it has one. The advertising may not say the Department recommends that home.
      </p>
      <p className={`mt-4 ${prose}`}>
        The endorsement is recorded on the facility license. It is not a quality score.
      </p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">Homes the state file lists</h2>
      <CountBlock
        snapshot={snapshot}
        source={office?.long ?? "Oregon DHS"}
        sentence={(row) =>
          row.endorsed == null || row.published == null
            ? missingCount()
            : `Oregon DHS lists a memory care endorsement on ${formatCount(row.endorsed)} of ${formatCount(row.published)} published homes in this directory.`
        }
      />
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">How to check one home</h2>
      <p className={`mt-4 ${prose}`}>
        Search the home&apos;s name on the{" "}
        <RuleLink href="https://ltclicensing.oregon.gov/">Oregon long-term care licensing site</RuleLink> and look for the endorsement on the license. This directory&apos;s page for the home links to that record when we have one.
      </p>
      <p className={`mt-4 ${prose}`}>
        <Link href="/oregon/facilities" className={linkCls}>Browse Oregon homes</Link>
        {" "}or read{" "}
        <Link href="/oregon/memory-care-licensing" className={linkCls}>how Oregon licenses memory care</Link>.
      </p>
      <p className={`mt-4 ${prose}`}>
        Washington&apos;s dementia-care contract is a different designation, and{" "}
        <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className={linkCls}>it is not a quality badge</Link>.
      </p>
    </>
  );
}

export async function PennsylvaniaDesignationBody() {
  const snapshot = await load("PA");
  const office = regulatorFor("PA");
  return (
    <>
      <p className={prose}>Pennsylvania uses two names, depending on the license.</p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">The rule</h2>
      <p className={`mt-4 ${prose}`}>
        On a personal care home, a secured dementia care unit is a home, or part of a home, that provides specialized care for residents with Alzheimer&apos;s disease or other dementia. That definition is in{" "}
        <RuleLink href="https://www.pacodeandbulletin.gov/secure/pacode/data/055/chapter2600/s2600.231.html">55 Pa. Code § 2600.231</RuleLink>.
      </p>
      <p className={`mt-4 ${prose}`}>
        On an assisted living residence, a special care unit is a residence, or part of a residence, that provides specialized care for residents with Alzheimer&apos;s disease or dementia. That definition is in{" "}
        <RuleLink href="https://www.pacodeandbulletin.gov/secure/pacode/data/055/chapter2800/s2800.231.html">55 Pa. Code § 2800.231</RuleLink>. The same chapter also covers a special care unit for intense neurobehavioral rehabilitation. The state file we hold labels this designation Special Care and does not split those two uses.
      </p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">Homes the state file lists</h2>
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
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">How to check one home</h2>
      <p className={`mt-4 ${prose}`}>
        Search the home in the{" "}
        <RuleLink href="https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/">Pennsylvania human services provider directory</RuleLink>. Then open the home&apos;s page in this directory.
      </p>
      <p className={`mt-4 ${prose}`}>
        <Link href="/pennsylvania/facilities" className={linkCls}>Browse Pennsylvania homes</Link>
        {" "}or read{" "}
        <Link href="/pennsylvania/memory-care-licensing" className={linkCls}>how Pennsylvania licenses memory care</Link>.
      </p>
      <p className={`mt-4 ${prose}`}>
        Washington&apos;s dementia-care contract is a different designation, and{" "}
        <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className={linkCls}>it is not a quality badge</Link>.
      </p>
    </>
  );
}

export async function MissouriDesignationBody() {
  const snapshot = await load("MO");
  const office = regulatorFor("MO");
  return (
    <>
      <p className={prose}>Missouri has no standalone memory care license.</p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">The rule</h2>
      <p className={`mt-4 ${prose}`}>
        <RuleLink href="https://revisor.mo.gov/main/OneSection.aspx?section=198.510">Section 198.510</RuleLink> requires a facility that offers an Alzheimer&apos;s special care unit or program to file a disclosure with the department that licenses it. The disclosure says how that unit&apos;s care differs from the rest of the facility. The department checks the disclosure when the license is renewed.
      </p>
      <p className={`mt-4 ${prose}`}>
        <RuleLink href="https://revisor.mo.gov/main/OneSection.aspx?section=198.073">Section 198.073.6</RuleLink> applies when an assisted living facility keeps a resident who cannot safely evacuate with minimal assistance. The facility must keep enough staff awake at all hours to help with evacuation, and put an evacuation plan in that resident&apos;s service plan. The state file marks that license ALF**. It is not the same filing as the special care unit disclosure.
      </p>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">Homes the state file lists</h2>
      <CountBlock
        snapshot={snapshot}
        source={office?.long ?? "Missouri DHSS"}
        sentence={(row) => {
          if (row.alzheimerScuDisclosure == null || row.alfStar == null) return missingCount();
          return `Missouri DHSS lists the Alzheimer's special care unit disclosure on ${formatCount(row.alzheimerScuDisclosure)} published homes. It lists the ALF** license on ${formatCount(row.alfStar)} published homes. A home is not in either count because its name says memory care.`;
        }}
      />
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-2xl text-navy">How to check one home</h2>
      <p className={`mt-4 ${prose}`}>
        Search the home on the{" "}
        <RuleLink href="https://healthapps.dhss.mo.gov/showmeltc/">DHSS long-term care lookup</RuleLink>. Ask the home for the disclosure it filed. The license class shows whether it is ALF**.
      </p>
      <p className={`mt-4 ${prose}`}>
        <Link href="/missouri/facilities" className={linkCls}>Browse Missouri homes</Link>
        {" "}or read{" "}
        <Link href="/missouri/memory-care-licensing" className={linkCls}>how Missouri licenses memory care</Link>.
      </p>
      <p className={`mt-4 ${prose}`}>
        Washington&apos;s dementia-care contract is a different designation, and{" "}
        <Link href="/washington/why-dshs-contract-isnt-a-quality-badge" className={linkCls}>it is not a quality badge</Link>.
      </p>
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
