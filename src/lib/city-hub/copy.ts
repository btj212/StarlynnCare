import type { Region } from "@/lib/regions";
import { clipMetaDescription, REGULATOR_ABBR } from "@/lib/seo/meta";
import { careSettingCopy } from "@/lib/city-hub/careSetting";
import type { CityHubGlance } from "@/lib/city-hub/stats";
import { hasReliable12MonthWindow } from "@/lib/city-hub/findings";
import type { FaqPair } from "@/lib/content/cityFaqs";
import { canonicalFor } from "@/lib/seo/canonical";

const TITLE_MAX = 60;
const AUTHORED_TITLE_MAX = 65;

function clipTitle(s: string, max = TITLE_MAX): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function cityKey(region: Region): string {
  return `${region.state.code}:${region.slug}`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatVisitDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const short = MONTHS_SHORT[(m ?? 1) - 1] ?? "";
  const mon = short === "May" ? "May" : `${short}.`;
  return `${mon} ${d}, ${y}`;
}

export function formatMonthYearLabel(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS_LONG[(m ?? 1) - 1] ?? ""} ${y}`;
}

export function cityHubTitle(
  region: Region,
  listedCount: number,
  extras?: { dementiaLicenseCount?: number },
): string {
  const code = region.state.code;
  const n = listedCount;
  const name = region.name;
  const key = cityKey(region);
  if (key === "WA:vancouver") {
    return "Memory Care Vancouver, WA: DSHS Records & Medicaid Contracts";
  }
  if (key === "WA:seattle") {
    return "Memory Care & Dementia Care Homes in Seattle, WA | DSHS Records";
  }
  if (key === "CO:denver") {
    return clipTitle(`Denver Memory Care Facilities: CDPHE Records for ${n} Homes`, AUTHORED_TITLE_MAX);
  }
  if (key === "CO:colorado-springs") {
    return clipTitle(`Colorado Springs Memory Care: CDPHE Records for ${n} Homes`, AUTHORED_TITLE_MAX);
  }
  if (key === "IL:chicago") {
    return clipTitle(
      `Chicago Memory Care & Alzheimer's Care: ${n} IDPH-Licensed Homes`,
      AUTHORED_TITLE_MAX,
    );
  }
  const aldc = extras?.dementiaLicenseCount ?? n;
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
          : code === "CA"
            ? [
                `${name} Memory Care: CA Inspection Records for ${n} Homes`,
                `${name}, CA: ${n} Homes — Inspection Records`,
              ]
            : code === "MN"
              ? [
                  `${name} Memory Care: MDH Records for ${aldc} Dementia Care Homes`,
                  `${name}, MN: MDH Records for ${aldc} Homes`,
                ]
              : code === "MO"
                ? [
                    `${name} Memory Care: MO Inspection Records for ${n} Homes`,
                    `${name}, MO: ${n} Homes — Inspection Records`,
                  ]
                : code === "OR"
                  ? [
                      `${name} Memory Care: Oregon Inspection Records for ${n} Homes`,
                      `${name}, OR: ${n} Homes — Inspection Records`,
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
  const city = region.name;
  const key = cityKey(region);
  if (key === "WA:vancouver") {
    return "Memory care and dementia care in Vancouver, WA: DSHS inspection records";
  }
  if (key === "WA:seattle") {
    return `Memory care and dementia care homes in Seattle, WA (King County): DSHS records for ${listedCount} homes`;
  }
  if (key === "CO:denver") {
    return `Memory care facilities in Denver, CO: CDPHE inspection records for ${listedCount} homes`;
  }
  if (key === "CO:colorado-springs") {
    return `Memory care and dementia care in Colorado Springs, CO: CDPHE records for ${listedCount} homes`;
  }
  if (key === "IL:chicago") {
    return `Memory care and Alzheimer's care in Chicago, IL: IDPH records for ${listedCount} homes`;
  }
  if (st === "CA") {
    return `Memory care in ${city}: California inspection records, home by home`;
  }
  if (st === "MN") {
    return `Memory care in ${city}: Minnesota dementia care licenses and inspection records`;
  }
  if (st === "MO") {
    return `Memory care in ${city}, MO: Missouri inspection records, home by home`;
  }
  if (st === "OR") {
    return `Memory care in ${city}, OR: endorsed homes and their Oregon DHS records`;
  }
  if (listedCount > 0) {
    return `${setting.h1Topic} in ${city}, ${st}: state inspection records for ${listedCount} homes`;
  }
  return `${setting.h1Topic} in ${city}, ${st}: state inspection records`;
}

export function cityHubMetaDescription(input: {
  region: Region;
  listedCount: number;
  withCitation: number;
  homesWithSeriousLast12?: number;
  homesWithTypeALast12?: number;
  regulatorAbbr: string;
}): string {
  const {
    region,
    listedCount,
    withCitation,
    homesWithSeriousLast12,
    homesWithTypeALast12,
    regulatorAbbr,
  } = input;
  const city = region.name;
  const code = region.state.code;
  const setting = careSettingCopy(code);
  const n = listedCount;
  const key = cityKey(region);

  let text: string;
  if (key === "WA:vancouver") {
    text =
      "Vancouver, WA memory care and dementia care homes with DSHS inspection records, Memory Care Certified status, and which take Medicaid for dementia care.";
  } else if (key === "WA:seattle") {
    text = `Compare ${n} Seattle memory care and dementia care homes in King County, WA using DSHS inspection records and Memory Care Certified status. No referral fees.`;
  } else if (key === "CO:denver") {
    text = `Compare ${n} Denver memory care facilities by CDPHE inspection record: citations, last visit, secure-environment findings. Colorado has no memory care license.`;
  } else if (key === "CO:colorado-springs") {
    text = `${n} Colorado Springs memory care homes and their CDPHE inspection records: every citation, last visit date, and any immediate-jeopardy findings on file.`;
  } else if (key === "IL:chicago") {
    text = `${n} Chicago assisted living homes with a dementia program, with their IDPH inspection records: violations, last visit, and links to state reports.`;
  } else if (code === "AZ") {
    const serious =
      homesWithSeriousLast12 != null
        ? `; ${homesWithSeriousLast12} had a serious citation in the last 12 months`
        : "";
    text = `Compare ${n} Directed Care homes in ${city} by Arizona inspection record. ${withCitation} have a citation on file${serious}. No referral fees.`;
  } else if (code === "WA") {
    text = `Compare ${n} ${city} assisted living and adult family homes that serve people with dementia, using ${regulatorAbbr} inspection records. No referral fees.`;
  } else if (code === "PA") {
    text = `Compare ${n} ${city}-area personal care and assisted living homes by PA DHS inspection record. Independent data, no referral fees.`;
  } else if (code === "TX") {
    text = `${n} Alzheimer-certified assisted living facilities in ${city}, ranked by HHSC inspection records.`;
  } else if (code === "CA") {
    const lead =
      homesWithTypeALast12 != null
        ? `${homesWithTypeALast12} of ${n} ${city} memory care homes got a Type A citation in the past year. `
        : `${withCitation} of ${n} ${city} memory care homes have a CDSS citation on file. `;
    text = `${lead}Compare CDSS inspection records, citations and listed prices. No referral fees.`;
  } else if (code === "MN") {
    const clean = Math.max(0, n - withCitation);
    text = `Compare ${city} assisted living with dementia care by MDH license and inspection record. ${clean} of ${n} homes have no finding on file. Free, no referral fees.`;
  } else if (code === "MO") {
    text = `${withCitation} of ${n} ${city} memory care homes have a Missouri DHSS citation on file. Compare citations, inspection dates and care levels. No referral fees.`;
  } else if (code === "OR") {
    text =
      withCitation === n && n > 0
        ? `Every ${city} memory care endorsed home here has an Oregon DHS citation on file. Compare violations, inspection dates and license type. No referral fees.`
        : `${withCitation} of ${n} ${city} memory care endorsed homes have an Oregon DHS citation on file. Compare violations, inspection dates and license type. No referral fees.`;
  } else {
    text = `${n} ${setting.hubNoun} in ${city}, ranked by ${regulatorAbbr} inspection records. ${withCitation > 0 ? `${withCitation} have citations on file.` : "Includes full citation history."}`;
  }
  return clipMetaDescription(text);
}

function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type CityDirectAnswerCost = {
  low: string;
  high: string;
  homes: number;
} | null;

export type CityAnswerFacts = {
  areaMemoryCareCount?: number;
  cityMemoryCareCertified?: number;
  sdcAcrossLists?: number;
  /** One visit's citations in the last 12 months, with the window total. */
  halfVisit?: { count: number; name: string; dateIso: string; windowTotal: number } | null;
  /** One home's citations in the last 36 months, with the window total. */
  thirdHome?: { count: number; name: string; windowTotal: number } | null;
  levelE?: { name: string; dateIso: string } | null;
};

export function cityDirectAnswer(input: {
  region: Region;
  glance: CityHubGlance;
  regulatorAbbr: string;
  listedPrice?: CityDirectAnswerCost;
  facts?: CityAnswerFacts;
}): { q: string; a: string } {
  const { region, glance, regulatorAbbr, listedPrice, facts } = input;
  const city = region.name;
  const st = region.state.code;
  const key = cityKey(region);
  const n = glance.listedCount;

  if (key === "WA:vancouver") {
    const inside = facts?.cityMemoryCareCertified ?? 0;
    const outside = facts?.areaMemoryCareCount ?? 0;
    const sdc = facts?.sdcAcrossLists ?? glance.sdcCount;
    return {
      q: "How do I find memory care in Vancouver, WA?",
      a: `DSHS lists ${inside + outside} Memory Care Certified assisted living facilities with a Vancouver mailing address: ${inside} inside city limits and ${outside} in unincorporated Clark County. Only homes with a DSHS Specialized Dementia Care contract can accept Medicaid for dementia care; ${sdc} of them have one in our records. Every home below links to its DSHS inspection reports.`,
    };
  }

  if (key === "CO:denver") {
    const visit = facts?.halfVisit;
    const clause =
      visit && visit.windowTotal > 0 && visit.count * 2 >= visit.windowTotal
        ? `, ${visit.count} of them at one visit to ${visit.name} on ${formatVisitDate(visit.dateIso)}`
        : "";
    return {
      q: "How do I check a Denver memory care facility?",
      a: `Colorado does not license memory care separately: homes are assisted living residences licensed by CDPHE, and a secure environment is optional. StarlynnCare lists ${n} Denver homes we can confirm offer memory care. In the last 12 months on file, inspectors wrote ${glance.citationsLast12} citations at these homes${clause}.`,
    };
  }

  if (key === "CO:colorado-springs") {
    const ij = facts?.levelE;
    const ijClause = ij
      ? ` including an immediate-jeopardy (Level E) finding at ${ij.name} in ${formatMonthYearLabel(ij.dateIso)}`
      : "";
    return {
      q: "How do I check memory care in Colorado Springs?",
      a: `Colorado has no separate memory care license, and CDPHE does not publish which homes run a secured dementia unit. StarlynnCare lists ${n} Colorado Springs homes we can confirm offer memory care; ${glance.withCitation} have CDPHE citations on file, ${glance.citationsLast36} in the last three years${ijClause}.`,
    };
  }

  if (key === "IL:chicago") {
    const home = facts?.thirdHome;
    const clause =
      home && home.windowTotal > 0 && home.count * 3 >= home.windowTotal
        ? `, ${home.count} of them at ${home.name}`
        : "";
    return {
      q: "How do I check a Chicago memory care home?",
      a: `In Illinois, assisted living establishments are licensed by IDPH. StarlynnCare lists ${n} Chicago homes with a dementia program; ${glance.withCitation} have at least one IDPH violation on file. In the last three years inspectors recorded ${glance.citationsLast36} violations at these homes${clause}.`,
    };
  }

  const setting = careSettingCopy(st);
  const small = glance.size.lte6 + glance.size.from7to10;
  const large = glance.size.gte11;
  const through = monthYear(glance.newestInspection);

  if (st === "AZ") {
    return {
      q: `How many Directed Care homes are in ${city}, ${st}?`,
      a: `Arizona lists ${n} Directed Care homes in ${city} with a public inspection record on this page. Licensed for Directed Care: Arizona authorizes these homes to provide memory care services (A.A.C. R9-10-816). That is the license level — not a claim that a given home runs a dedicated secured memory-care unit. Most are small: ${small} have 10 beds or fewer, and ${large} have 11 or more. Over the last 12 months state inspectors visited ${city} homes ${glance.inspectionsLast12} times and wrote ${glance.citationsLast12} citations; ${glance.homesWithSeriousLast12} homes received a serious citation. StarlynnCare takes no referral fees.`,
    };
  }

  if (st === "WA") {
    return {
      q: `How do I check a ${city} dementia care community?`,
      a: `${regulatorAbbr} inspects every assisted living facility and adult family home. StarlynnCare lists ${n} ${city} homes that serve residents with dementia, ${large} of them larger assisted living communities, with every ${regulatorAbbr} inspection and citation on file. Only facilities with a DSHS Specialized Dementia Care contract can accept Medicaid for dementia care; ${glance.sdcCount} ${city} ${glance.sdcCount === 1 ? "home has" : "homes have"} one.`,
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

  if (st === "CA") {
    const price = listedPrice
      ? ` Listed prices run ${listedPrice.low} to ${listedPrice.high} a month (middle half of ${listedPrice.homes} homes with a listed price).`
      : "";
    return {
      q: `How do I check a ${city} memory care facility's record?`,
      a: `Memory care in California is provided by licensed Residential Care Facilities for the Elderly (RCFEs), inspected by the California Department of Social Services. Of the ${n} ${city} homes on this page, ${glance.withCitation} have a citation on file. In the last 12 months inspectors wrote ${glance.citationsLast12} citations here, ${glance.typeALast12} of them Type A (immediate health or safety risk), at ${glance.homesWithTypeALast12} homes.${price}`,
    };
  }

  if (st === "MN") {
    const aldc = glance.dementiaLicenseCount;
    const windowNote =
      glance.citationsLast12 === 0
        ? "none has a finding dated in the last 12 months"
        : `${glance.citationsLast12} findings are dated in the last 12 months`;
    return {
      q: `How do I check a ${city} memory care home?`,
      a: `In Minnesota, memory care needs an Assisted Living with Dementia Care license from the Minnesota Department of Health (Minn. Stat. ch. 144G). ${aldc} of the ${n} ${city} homes on this page hold that license. ${glance.withCitation} have an MDH finding on file, and ${windowNote}. A clean record can also mean few visits, so check each home's last inspection date.`,
    };
  }

  if (st === "MO") {
    const perHome =
      n > 0 && glance.citationsLast36 > 0
        ? (glance.citationsLast36 / n).toFixed(1)
        : null;
    const throughClause = through ? ` Inspection records on file run through ${through}.` : "";
    const perHomeClause = perHome
      ? ` Over the last three years inspectors wrote ${glance.citationsLast36} citations at these homes, ${perHome} per home.`
      : "";
    return {
      q: `How do I check a ${city} memory care home?`,
      a: `In Missouri, memory care is provided in licensed assisted living and residential care facilities inspected by the Department of Health and Senior Services (DHSS). ${glance.withCitation} of the ${n} ${city} homes on this page have at least one DHSS citation on file.${perHomeClause}${throughClause}`,
    };
  }

  if (st === "OR") {
    const top =
      glance.topCitedLast12Name && glance.topCitedLast12Count > 0
        ? `, ${glance.topCitedLast12Count} of them at one visit to ${glance.topCitedLast12Name}`
        : "";
    return {
      q: `How do I check a ${city} memory care home?`,
      a: `In Oregon, a home needs a Memory Care Endorsement from the Department of Human Services to offer memory care. Most are licensed residential care facilities (RCFs). ${glance.withCitation === n && n > 0 ? `All ${n}` : `${glance.withCitation} of the ${n}`} endorsed homes on this page have at least one citation on file. In the last 12 months, inspectors recorded ${glance.citationsLast12} citations at these homes${top}. Oregon publishes every report on its Long-Term Care Licensing site.`,
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

  if (st === "CA") {
    extras.push({
      q: `What is a Type A citation?`,
      a: `A Type A deficiency is CDSS's most serious class: an immediate risk to health or safety. Type B is a lesser violation. Of the ${glance.listedCount} ${city} homes on this page, ${glance.homesWithTypeALast12} had a Type A citation in the last 12 months. Each profile links to the CDSS record.`,
    });
  }

  if (st === "MN") {
    extras.push({
      q: `What is an ALDC license?`,
      a: `Assisted Living with Dementia Care (ALDC) is Minnesota's dementia-care license under Minn. Stat. ch. 144G, issued by the Minnesota Department of Health. It requires dementia-trained staff, individualized programming, and a secured environment where clinically indicated. ${glance.dementiaLicenseCount} of the ${glance.listedCount} ${city} homes on this page hold that license. Homes licensed only as assisted living (AL) are labeled separately and are not counted as licensed memory care.`,
    });
  }

  if (st === "MO") {
    extras.push(
      {
        q: `What is an Alzheimer's special care unit in Missouri?`,
        a: `Missouri does not issue a separate memory-care license. A facility that specializes in, advertises, or represents itself as providing Alzheimer's or dementia care must file an Alzheimer's Special Care Services Disclosure under RSMo §198.510 (Form MO 580-2637). ALF vs RCF is the DHSS level of care on the license (19 CSR 30). StarlynnCare shows that level when it is on the row.`,
      },
      {
        q: `How do I read a DHSS inspection report?`,
        a: `Missouri DHSS cites assisted living and residential care under 19 CSR 30. Class I is the most serious class, then Class II, then Class III. Stored severity numbers on some rows do not match that order, so this page does not treat a high severity number as "serious." Each profile links to the DHSS record. Inspection records on file for ${city} run through ${monthYear(glance.newestInspection) ?? "the latest visit we stored"}.`,
      },
    );
  }

  if (st === "OR") {
    extras.push({
      q: `What is a Consumer Summary Statement?`,
      a: `Oregon requires a Consumer Summary Statement for assisted living and residential care homes that offer memory care. It is the facility's own description of services, staffing, and the Memory Care Endorsement program, filed with DHS Long-Term Care Licensing. It is not an inspection grade. Each profile links to the Oregon LTC Licensing site where that packet is published.`,
    });
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
  const showSerious =
    glance.severityMeasured && hasReliable12MonthWindow(glance.inspectionsLast12);
  if (showSerious) {
    items.push({
      n: String(glance.seriousLast12),
      label: "Serious citations in the last 12 months",
      src,
      delta:
        glance.homesWithSeriousLast12 > 0
          ? `at ${glance.homesWithSeriousLast12} homes`
          : "none on listed homes",
    });
  } else if (!glance.severityMeasured && region.state.code === "OR") {
    items.push({
      n: String(glance.citationsLast12),
      label: "Oregon DHS citations in the last 12 months (no severity grade in our data)",
      src,
    });
  } else if (!glance.severityMeasured) {
    const abbr = REGULATOR_ABBR[region.state.code] ?? "The state regulator";
    items.push({
      n: String(glance.citationsLast12),
      label: `${abbr} does not grade most citations by severity in our data`,
      src,
    });
  }
  return items;
}
