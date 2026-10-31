import type { DeslopSection } from "@/lib/content/reviewArticles";

export const OREGON_DESIGNATION_DESLOP: DeslopSection[] = [
  {
    heading: "Opening",
    passes: [
      {
        before:
          "Oregon's gold-standard Memory Care Endorsement is the essential credential families should demand before trusting a community's dementia marketing.",
        after:
          "Advertising as a memory care community is prohibited prior to DHS endorsement issuance.",
        cut: "gold-standard, essential credential, families should demand, trusting",
      },
      {
        before:
          "Advertising as a memory care community is prohibited prior to DHS endorsement issuance.",
        after:
          "A home may not advertise itself as a memory care community until Oregon DHS has granted a memory care endorsement.",
        cut: "prohibited prior to, issuance",
      },
    ],
  },
  {
    heading: "The rule",
    passes: [
      {
        before:
          "Under the applicable statutory framework, facilities are generally restricted from holding themselves out as memory care until an endorsement is in place, and advertising must not imply departmental recommendation.",
        after:
          "ORS 443.886 says a facility may not advertise or market itself as an Alzheimer's care unit or memory care community unless it has the endorsement. OAR 411-057-0130 says an applicant may not advertise as a memory care community until the Department has granted the endorsement. A home with the endorsement may say that it has one. The advertising may not say the Department recommends that home.",
        cut: "applicable statutory framework, generally restricted, holding themselves out",
      },
      {
        before:
          "ORS 443.886 says a facility may not advertise or market itself as an Alzheimer's care unit or memory care community unless it has the endorsement. OAR 411-057-0130 says an applicant may not advertise as a memory care community until the Department has granted the endorsement. A home with the endorsement may say that it has one. The advertising may not say the Department recommends that home. The endorsement is basically a quality signal families can rely on.",
        after:
          "The endorsement is recorded on the facility license. It is not a quality score.",
        cut: "basically a quality signal families can rely on",
      },
    ],
  },
  {
    heading: "How to check one home",
    passes: [
      {
        before:
          "Simply navigate the intuitive state portal and you will easily find whether the community is endorsed.",
        after:
          "Search the home's name on the Oregon long-term care licensing site and look for the endorsement on the license.",
        cut: "simply, intuitive, easily",
      },
      {
        before:
          "Search the home's name on the Oregon long-term care licensing site and look for the endorsement on the license. Our pages seamlessly connect you to the regulator.",
        after:
          "This directory's page for the home links to that record when we have one.",
        cut: "seamlessly connect you",
      },
    ],
  },
];

export const PENNSYLVANIA_DESIGNATION_DESLOP: DeslopSection[] = [
  {
    heading: "Opening",
    passes: [
      {
        before:
          "Pennsylvania offers a comprehensive suite of dementia designations that empower families to identify true memory care.",
        after: "Pennsylvania uses two names, depending on the license.",
        cut: "comprehensive suite, empower, true memory care",
      },
      {
        before: "Pennsylvania utilizes dual nomenclature contingent on licensure category.",
        after: "Pennsylvania uses two names, depending on the license.",
        cut: "utilizes, dual nomenclature, contingent on licensure category",
      },
    ],
  },
  {
    heading: "The rule",
    passes: [
      {
        before:
          "A secured dementia care unit is essentially the personal-care version of memory care, and special care is the assisted-living equivalent families should treat as the same thing.",
        after:
          "On a personal care home, a secured dementia care unit is a home, or part of a home, that provides specialized care for residents with Alzheimer's disease or other dementia. On an assisted living residence, a special care unit is a residence, or part of a residence, that provides specialized care for residents with Alzheimer's disease or dementia.",
        cut: "essentially, equivalent, families should treat as the same thing",
      },
      {
        before:
          "The same chapter also covers a special care unit for intense neurobehavioral rehabilitation, but that nuance is probably not worth mentioning.",
        after:
          "The same chapter also covers a special care unit for intense neurobehavioral rehabilitation. The state file we hold labels this designation Special Care and does not split those two uses.",
        cut: "that nuance is probably not worth mentioning",
      },
    ],
  },
  {
    heading: "How to check one home",
    passes: [
      {
        before: "Just look it up on the state website and you should be all set.",
        after:
          "Search the home in the Pennsylvania human services provider directory. Then open the home's page in this directory.",
        cut: "just, all set",
      },
      {
        before:
          "Search the home in the Pennsylvania human services provider directory in order to operationalize verification.",
        after:
          "Search the home in the Pennsylvania human services provider directory. Then open the home's page in this directory.",
        cut: "in order to operationalize verification",
      },
    ],
  },
];

export const MISSOURI_DESIGNATION_DESLOP: DeslopSection[] = [
  {
    heading: "Opening",
    passes: [
      {
        before:
          "Missouri families can rest assured that a dedicated memory care license protects their loved one.",
        after: "Missouri has no standalone memory care license.",
        cut: "rest assured, dedicated license protects",
      },
      {
        before: "Missouri does not maintain a standalone memory care licensure category.",
        after: "Missouri has no standalone memory care license.",
        cut: "maintain, licensure category",
      },
    ],
  },
  {
    heading: "The rule",
    passes: [
      {
        before:
          "Section 198.510 basically makes facilities disclose their Alzheimer's program, and ALF** is the better, safer license.",
        after:
          "Section 198.510 requires a facility that offers an Alzheimer's special care unit or program to file a disclosure with the department that licenses it. The disclosure says how that unit's care differs from the rest of the facility. The department checks the disclosure when the license is renewed.",
        cut: "basically, better, safer license",
      },
      {
        before:
          "Section 198.073.6 authorizes a special ALF** credential for non-self-evacuating residents.",
        after:
          "Section 198.073.6 applies when an assisted living facility keeps a resident who cannot safely evacuate with minimal assistance. The facility must keep enough staff awake at all hours to help with evacuation, and put an evacuation plan in that resident's service plan. The state file marks that license ALF**.",
        cut: "authorizes a special credential",
      },
    ],
  },
  {
    heading: "Homes the state file lists",
    passes: [
      {
        before: "We also count homes whose names mention memory care, because that is a useful signal.",
        after: "A home is not in either count because its name says memory care.",
        cut: "names mention memory care, useful signal",
      },
      {
        before: "Name-keyword matches are excluded from the designation numerator.",
        after: "A home is not in either count because its name says memory care.",
        cut: "name-keyword matches, numerator",
      },
    ],
  },
];

export const TEXAS_DESIGNATION_DESLOP: DeslopSection[] = [
  {
    heading: "Opening",
    passes: [
      {
        before:
          "Texas Alzheimer's certification is the premier badge of specialized dementia excellence.",
        after:
          "A Texas assisted living facility that advertises specialized care for people with Alzheimer's disease or a related disorder must hold an Alzheimer's certification.",
        cut: "premier badge, excellence",
      },
      {
        before:
          "An assisted living facility advertising specialized Alzheimer's care is required to possess certification.",
        after:
          "A Texas assisted living facility that advertises specialized care for people with Alzheimer's disease or a related disorder must hold an Alzheimer's certification.",
        cut: "possess certification",
      },
    ],
  },
  {
    heading: "The rule",
    passes: [
      {
        before:
          "The certificate lasts a while and should be posted somewhere, and casual phrases about forgetfulness might still count as certification.",
        after:
          "The certificate is for a Type B facility, or a unit of a Type B facility. It is valid for three years. The home must post it where the public can see it. Words such as medication reminders or short-term memory loss do not, by themselves, require the certificate.",
        cut: "lasts a while, somewhere, might still count",
      },
      {
        before:
          "Certification under 26 TAC § 553.27 is limited to a Type B facility or unit, remains valid for a triennial period, and must be publicly posted. Certain reminder terminology is independently insufficient to trigger the requirement.",
        after:
          "The certificate is for a Type B facility, or a unit of a Type B facility. It is valid for three years. The home must post it where the public can see it. Words such as medication reminders or short-term memory loss do not, by themselves, require the certificate.",
        cut: "triennial period, independently insufficient to trigger",
      },
    ],
  },
  {
    heading: "How to check one home",
    passes: [
      {
        before: "Hop onto the HHSC portal and the certificate will be obvious.",
        after:
          "Search the home on the HHSC long-term care search and look for the posted certificate. This directory's page for the home says when HHSC lists a certification, including the certificate number when we have one.",
        cut: "hop onto, obvious",
      },
      {
        before:
          "Search the home on the HHSC long-term care search and look for the posted certificate. Our profile always displays the certificate number.",
        after:
          "This directory's page for the home says when HHSC lists a certification, including the certificate number when we have one.",
        cut: "always displays",
      },
    ],
  },
];
