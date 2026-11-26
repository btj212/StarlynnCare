import type { Region } from "@/lib/regions";
import { clipMetaDescription } from "@/lib/seo/meta";
import { careSettingCopy } from "@/lib/city-hub/careSetting";
import type { CityHubGlance } from "@/lib/city-hub/stats";
import type { FaqPair } from "@/lib/content/cityFaqs";
import { canonicalFor } from "@/lib/seo/canonical";

const TITLE_MAX = 60;

function clipTitle(s: string): string {
  if (s.length <= TITLE_MAX) return s;
  const cut = s.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > TITLE_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export function cityHubTitle(region: Region, listedCount: number): string {
  const code = region.state.code;
  const n = listedCount;
  const name = region.name;
  const candidates =
    code === "AZ"
      ? [
          `${name}, AZ: ${n} Directed Care Homes — Inspection Records`,
          `${name}, AZ: ${n} Directed Care Homes`,
          `${name}, AZ Directed Care: ${n} Homes`,
        ]
      : code === "WA"
        ? [
            `${name}, WA: ${n} Homes and Their Inspection Records`,
            `${name}, WA: Inspection Records for ${n} Homes`,
            `${name}, WA: ${n} Homes — Inspection Records`,
          ]
        : code === "PA"
          ? [
              `${name}, PA: ${n} Homes and Their Inspection Records`,
              `${name} Memory Care: Inspection Records for ${n} Homes`,
              `${name}, PA: ${n} Homes — Inspection Records`,
            ]
          : [
              `${name}, ${code}: ${n} Memory Care Homes — Inspection Records`,
              `${name}, ${code}: ${n} Homes — Inspection Records`,
              `Memory Care in ${name}, ${code}`,
            ];
  return clipTitle(candidates.find((c) => c.length <= TITLE_MAX) ?? candidates.at(-1)!);
}

export function cityHubH1(region: Region, listedCount: number): string {
  const setting = careSettingCopy(region.state.code);
  const st = region.state.code;
  if (listedCount > 0) {
    return `${setting.h1Topic} in ${region.name}, ${st}: state inspection records for ${listedCount} homes`;
  }
  return `${setting.h1Topic} in ${region.name}, ${st}: state inspection records`;
}

export function cityHubMetaDescription(input: {
  region: Region;
  listedCount: number;
  withCitation: number;
  homesWithSeriousLast12?: number;
  regulatorAbbr: string;
}): string {
  const { region, listedCount, withCitation, homesWithSeriousLast12, regulatorAbbr } = input;
  const city = region.name;
  const code = region.state.code;
  const setting = careSettingCopy(code);

  let text: string;
  if (code === "AZ") {
    const serious =
      homesWithSeriousLast12 != null
        ? `; ${homesWithSeriousLast12} had a serious citation in the last 12 months`
        : "";
    text = `Compare ${listedCount} Directed Care homes in ${city} by Arizona inspection record. ${withCitation} have a citation on file${serious}. No referral fees.`;
  } else if (code === "WA") {
    text = `Compare ${listedCount} ${city} assisted living and adult family homes that serve people with dementia, using ${regulatorAbbr} inspection records. No referral fees.`;
  } else if (code === "PA") {
    text = `Compare ${listedCount} ${city}-area personal care and assisted living homes by PA DHS inspection record. Independent data, no referral fees.`;
  } else if (code === "TX") {
    text = `${listedCount} Alzheimer-certified assisted living facilities in ${city}, ranked by HHSC inspection records.`;
  } else {
    text = `${listedCount} ${setting.hubNoun} in ${city}, ranked by ${regulatorAbbr} inspection records. ${withCitation > 0 ? `${withCitation} have citations on file.` : "Includes full citation history."}`;
  }
  return clipMetaDescription(text);
}

export function cityDirectAnswer(input: {
  region: Region;
  glance: CityHubGlance;
  regulatorAbbr: string;
}): { q: string; a: string } {
  const { region, glance, regulatorAbbr } = input;
  const city = region.name;
  const st = region.state.code;
  const setting = careSettingCopy(st);
  const n = glance.listedCount;
  const small = glance.size.lte6 + glance.size.from7to10;
  const large = glance.size.gte11;

  if (st === "AZ") {
    return {
      q: `How many Directed Care homes are in ${city}, ${st}?`,
      a: `Arizona lists ${n} Directed Care homes in ${city} with a public inspection record on this page. Licensed for Directed Care: Arizona authorizes these homes to provide memory care services (A.A.C. R9-10-816). That is the license level — not a claim that a given home runs a dedicated secured memory-care unit. Most are small: ${small} have 10 beds or fewer, and ${large} have 11 or more. Over the last 12 months state inspectors visited ${city} homes ${glance.inspectionsLast12} times and wrote ${glance.citationsLast12} citations; ${glance.homesWithSeriousLast12} homes received a serious citation. StarlynnCare takes no referral fees.`,
    };
  }

  if (st === "WA") {
    return {
      q: `How do I check a ${city} dementia care community?`,
      a: `${regulatorAbbr} inspects every assisted living facility and adult family home. StarlynnCare lists ${n} ${city} homes that serve residents with dementia, ${large} of them larger assisted living communities, with every ${regulatorAbbr} inspection and citation on file. Only facilities with a DSHS Specialized Dementia Care contract can accept Medicaid for dementia care; ${glance.sdcCount} ${city} homes on this page have one.`,
    };
  }

  if (st === "PA") {
    const pch = glance.pchCount;
    const alr = glance.alrCount;
    return {
      q: `How do I compare dementia care homes in ${city}?`,
      a: `This page lists ${n} ${city}-area homes with a public PA DHS inspection record — ${pch} Personal Care Homes and ${alr} Assisted Living Residences among those with a license type on file. ${setting.licenseExplainer} ${glance.withCitation} of ${n} listed homes have at least one citation on file; inspectors wrote ${glance.citationsLast12} citations at them in the last 12 months. StarlynnCare takes no referral fees.`,
    };
  }

  return {
    q: `How many ${setting.hubNoun} are in ${city}?`,
    a: `StarlynnCare lists ${n} ${setting.hubNoun} in ${city} with a public inspection record. ${glance.withCitation} (${glance.withCitationPct}%) have a citation on file. ${setting.licenseExplainer} StarlynnCare takes no referral fees.`,
  };
}

export function cityFaqExtras(input: {
  region: Region;
  glance: CityHubGlance;
}): FaqPair[] {
  const { region, glance } = input;
  const city = region.name;
  const st = region.state.code;
  const extras: FaqPair[] = [];

  if (st === "AZ") {
    extras.push(
      {
        q: `What is the difference between assisted living and memory care in Arizona?`,
        a: `Arizona licenses assisted living as homes (ALH, up to 10 residents) or centers (ALC, 11 or more), each at a care level: Supervisory, Personal, or Directed Care. Licensed for Directed Care means Arizona authorizes the home to provide memory care services under A.A.C. R9-10-816 (policies, wandering safeguards, a medical-practitioner evaluation, and eight hours of staff training). HB2764 directed ADHS to write those standards for Directed Care homes; it did not create a separate Memory Care subclass. See <a href="${canonicalFor("/arizona/memory-care-licensing")}" class="text-teal underline underline-offset-4">Arizona memory care licensing</a>.`,
      },
      {
        q: `How do you pay for Directed Care with ALTCS in ${city}?`,
        a: `Arizona Long Term Care System (ALTCS) can fund residential care in a Directed Care ALH or ALC for eligible residents through contracted managed care organizations. Not every ${city} home accepts ALTCS, and bed availability changes. Ask the home about its contract status, and contact AHCCCS for eligibility.`,
      },
      {
        q: `How do I check a ${city} home's inspection record?`,
        a: `Every profile on this page links to AZ Care Check, the ADHS consumer portal. You can also search by name or license number at azcarecheck.azdhs.gov. StarlynnCare lists ${glance.listedCount} ${city} Directed Care homes with a public record; ${glance.withCitation} have at least one citation on file.`,
      },
    );
  }

  if (st === "WA") {
    extras.push(
      {
        q: `What is an adult family home in Washington?`,
        a: `An adult family home (AFH) is a DSHS-licensed residence for two to six people, often in a regular house. Assisted living facilities are larger. Of the ${glance.listedCount} ${city} homes listed here, ${glance.size.lte6} have 6 beds or fewer. An AFH license is not a Specialized Dementia Care contract.`,
      },
      {
        q: `What does Memory Care Certified mean in Washington?`,
        a: `Washington is rolling a "Memory Care Certified" designation separately from the existing Specialized Dementia Care (SDC) contract. StarlynnCare labels a home memory care when DSHS records an SDC contract or an adult family home dementia specialty. ${glance.sdcCount} of ${glance.listedCount} listed ${city} homes have an SDC contract on file. Homes without that file stay listed with neutral wording.`,
      },
    );
  }

  if (st === "PA") {
    extras.push(
      {
        q: `Does Medicare pay for assisted living in Pennsylvania?`,
        a: `Medicare does not pay room and board in a Personal Care Home or Assisted Living Residence. It may cover short skilled-nursing stays in a certified nursing facility. Pennsylvania Medical Assistance can fund some personal-care services through HealthChoices for eligible residents, but not the daily base rate. Ask each ${city} home which programs it accepts.`,
      },
      {
        q: `How do I read a PA personal care home inspection?`,
        a: `PA DHS OLTL cites Personal Care Homes under 55 Pa Code Chapter 2600 and Assisted Living Residences under Chapter 2800. Typical labels are Citation, Civil Money Penalty, Provisional License, Substantiated Abuse, and Revocation. Immediate Jeopardy is a CMS nursing-home term; StarlynnCare does not apply it to a 55 Pa Code finding. Each profile links to the DHS record.`,
      },
    );
  }

  return extras;
}

export function cityGlanceStats(
  region: Region,
  glance: CityHubGlance,
  src: string,
): Array<{ n: string; label: string; src: string; delta?: string }> {
  const city = region.name;
  const setting = careSettingCopy(region.state.code);
  const items: Array<{ n: string; label: string; src: string; delta?: string }> = [
    {
      n: String(glance.listedCount),
      label: `${setting.hubNoun} listed in ${city}`,
      src,
    },
  ];
  if (glance.bedsTotal > 0) {
    items.push({
      n: glance.bedsTotal.toLocaleString("en-US"),
      label: "Licensed beds among listed homes",
      src,
    });
  }
  if (glance.zipCount > 0) {
    items.push({
      n: String(glance.zipCount),
      label: `ZIP codes represented in ${city}`,
      src,
    });
  }
  items.push({
    n: `${glance.withCitationPct}%`,
    label: "Listed homes with at least one citation on file",
    src,
    delta: `${glance.withCitation} of ${glance.listedCount}`,
  });
  items.push({
    n: String(glance.seriousLast12),
    label: "Serious citations in the last 12 months",
    src,
    delta:
      glance.homesWithSeriousLast12 > 0
        ? `at ${glance.homesWithSeriousLast12} homes`
        : "none on listed homes",
  });
  return items;
}
