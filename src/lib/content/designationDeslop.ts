import type { DeslopSection } from "@/lib/content/reviewArticles";

function passes(heading: string, first: [string, string, string], second: [string, string, string]): DeslopSection {
  return {
    heading,
    passes: [
      { before: first[0], after: first[1], cut: first[2] },
      { before: second[0], after: second[1], cut: second[2] },
    ],
  };
}

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
  passes(
    "Opening answer",
    [
      "Want to know if an Oregon community is truly qualified for memory care? The answer lies in a special state endorsement that sets the best homes apart.",
      "Check the license. Oregon DHS records a memory care endorsement on the license of a facility that runs a memory care community.",
      "truly qualified, the answer lies in, sets the best homes apart",
    ],
    [
      "Check the license. Oregon DHS records a memory care endorsement on the license of a facility that runs a memory care community.",
      "Check the license. Oregon DHS records a memory care endorsement on the license of a residential care, assisted living, or nursing facility that runs a memory care community.",
      "a facility (named the three license types instead)",
    ],
  ),
  passes(
    "Application and inspection",
    [
      "Getting endorsed is a rigorous, multi-step process that ensures only committed providers earn the right to serve people with dementia.",
      "A home applies on form APD 940 at least 60 days before it wants the endorsement. DHS inspects the unit on site before it issues the endorsement.",
      "rigorous, multi-step, ensures, committed providers, earn the right",
    ],
    [
      "A home applies on form APD 940 at least 60 days before it wants the endorsement. DHS inspects the unit on site before it issues the endorsement. Fees are modest and scale with the size of the community.",
      "The endorsement is renewed with the facility license. The application fee is $50, $75, or $100, depending on how many memory care residents the unit holds.",
      "modest, scale with the size of the community",
    ],
  ),
  passes(
    "What does an endorsed home have to do?",
    [
      "Endorsed communities go above and beyond, with extensive dementia training, thoughtful staffing, beautiful secure gardens, and robust safety protocols.",
      "Every staff member completes dementia care training before giving care alone. Direct care staff complete 16 hours of in-service training each year. The unit is on the ground level, with a secured outdoor area.",
      "go above and beyond, extensive, thoughtful, beautiful, robust",
    ],
    [
      "Staffing levels are generous and tailored to every resident around the clock, and wandering incidents are handled immediately with full transparency.",
      "Staffing must meet residents' scheduled and unscheduled needs. Night staffing is set by residents' sleep patterns and needs. If a resident leaves the unit without staff knowing, the home calls 911 or local police after a first search and notifies DHS, the Ombudsman, and the representative within 24 hours.",
      "generous, tailored to every resident, immediately, full transparency",
    ],
  ),
  passes(
    "How do I check one Oregon home? (record contents)",
    [
      "The state site gives you a complete, real-time view of everything that has ever happened at the home.",
      "The same record shows routine inspections, inspections after a complaint, substantiated violations, and regulatory actions. DHS says the site updates every 24 hours.",
      "complete, real-time, everything that has ever happened",
    ],
    [
      "DHS says the site updates every 24 hours, so nothing is left out.",
      "DHS says the site updates every 24 hours, and complaints still under investigation or findings under appeal are not shown.",
      "so nothing is left out",
    ],
  ),
  passes(
    "What should I ask an Oregon home?",
    [
      "Be sure to grill the community on its dementia credentials so you can feel confident in your choice.",
      "Ask for the memory care uniform disclosure statement before you sign. Ask how staff search for a resident who leaves the unit, and who they call.",
      "grill, dementia credentials, feel confident in your choice",
    ],
    [
      "It's also a great idea to inquire about the level of training staff have received and to request a tour of the lovely outdoor space.",
      "Ask how many hours of dementia training direct care staff completed this year. Ask to see the secured outdoor area.",
      "great idea, inquire, level of training, lovely",
    ],
  ),
  passes(
    "Common questions",
    [
      "An endorsement is a strong sign that a home delivers excellent memory care.",
      "No. Oregon's rules say an endorsement is not a recommendation by the Department.",
      "strong sign, delivers excellent memory care",
    ],
    [
      "Endorsed homes are inspected frequently and thoroughly to keep families safe.",
      "On the schedule of their underlying license. Oregon surveys assisted living and residential care facilities every 24 months, and DHS also inspects after complaints.",
      "frequently and thoroughly, keep families safe",
    ],
  ),
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
  passes(
    "Opening answer",
    [
      "Navigating Pennsylvania's memory care landscape can feel overwhelming, but two key designations unlock the answer.",
      "Look for one of two Department of Human Services designations: a secured dementia care unit or a special care unit.",
      "navigating, landscape, feel overwhelming, unlock the answer",
    ],
    [
      "Look for one of two Department of Human Services designations: a secured dementia care unit or a special care unit.",
      "A personal care home can have a secured dementia care unit. An assisted living residence can have a special care unit. DHS inspects and approves either unit before it opens.",
      "(split the two license types into their own sentences and added the approval step)",
    ],
  ),
  passes(
    "Application to DHS",
    [
      "Opening a unit requires an extensive application that proves the home is fully prepared for dementia care.",
      "A home must apply to DHS at least 60 days before it opens a unit, adds one, raises its capacity, or changes its locks, exit doors, or floor plan.",
      "extensive, proves, fully prepared",
    ],
    [
      "The filing covers all the essentials of safe operations.",
      "The filing includes the locking system, the policy for emergency exits and residents who leave, a sample two-week staffing schedule, proof of the extra training, and floor plans.",
      "all the essentials of safe operations",
    ],
  ),
  passes(
    "What does a secured dementia care unit have to do?",
    [
      "Pennsylvania sets a high bar with careful medical screening that guarantees every resident truly belongs in the unit.",
      "A physician, physician assistant, or certified registered nurse practitioner documents the dementia diagnosis and the need for the unit within 60 days before admission. A written cognitive preadmission screening is completed within 72 hours before admission.",
      "sets a high bar, careful, guarantees, truly belongs",
    ],
    [
      "State-of-the-art locks keep residents safe while still meeting fire codes.",
      "Locked exit doors need written approval from the Department of Labor and Industry, the Department of Health, or the local building authority. The locks must release on a fire alarm, a power failure, or a keypad override.",
      "state-of-the-art, keep residents safe, still meeting fire codes",
    ],
  ),
  passes(
    "Directory search tips",
    [
      "The DHS directory is easy to use once you know a few insider tricks.",
      "Choose the Office of Long-Term Living as the program office, and type at least four characters of the home's name.",
      "easy to use, insider tricks",
    ],
    [
      "The directory is always up to date.",
      "DHS says the directory refreshes daily.",
      "always up to date",
    ],
  ),
  passes(
    "What should I ask a Pennsylvania home?",
    [
      "Don't be shy about asking tough questions to make sure the unit is the perfect fit.",
      "Ask which license the home holds, and whether your family member would live in the secured or special care unit.",
      "don't be shy, tough questions, perfect fit",
    ],
    [
      "Make sure to dig into the fine print of the contract and the home's emergency readiness.",
      "Ask for the contract's section on services, discharge criteria, and fees before you sign. Ask what happens to the door locks when the fire alarm sounds or the power fails.",
      "dig into the fine print, emergency readiness",
    ],
  ),
  passes(
    "Common questions",
    [
      "Pennsylvania offers memory care licensing through its dementia unit programs.",
      "Not by that name. A personal care home can run a secured dementia care unit, and an assisted living residence can run a special care unit.",
      "offers memory care licensing, programs",
    ],
    [
      "Residents without dementia generally can't live in the unit.",
      "Yes, if the resident wants to. Section 2600.231(g) requires a medical evaluation, and the resident must be able to use the keypad or other device that opens the unit's doors.",
      "generally can't (wrong; the rule allows it)",
    ],
  ),
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
  passes(
    "Opening answer",
    [
      "Missouri takes a unique approach to memory care that savvy families should understand.",
      "Missouri has no standalone memory care license. Check for one of two filings instead.",
      "unique approach, savvy families should understand",
    ],
    [
      "Check for one of two filings instead: the disclosure or the special license.",
      "A home that offers an Alzheimer's special care unit or program must file a disclosure with the state. An assisted living facility that keeps residents who cannot evacuate on their own holds a license the state file marks ALF**.",
      "the special license",
    ],
  ),
  passes(
    "ALF** added duties",
    [
      "ALF** homes also offer enriching exploration and cutting-edge monitoring technology.",
      "The same section adds two more duties for that resident: a chance to explore the facility and its grounds, and a personal electronic monitoring device.",
      "enriching, cutting-edge technology",
    ],
    [
      "The same section adds two more duties for that resident: a chance to explore the facility and its grounds, and a personal electronic monitoring device.",
      "The same section adds two more duties for that resident: a chance to explore the facility and, where appropriate, its grounds, and a personal electronic monitoring device if the resident's physician recommends one.",
      "(restored the statute's two conditions)",
    ],
  ),
  passes(
    "What does the disclosure cover?",
    [
      "The disclosure is a comprehensive window into everything that makes the unit special.",
      "Section 198.510 has the home explain how the unit differs from the rest of the facility in nine areas.",
      "comprehensive window, everything that makes the unit special",
    ],
    [
      "Families are entitled to review this important document at their convenience.",
      "The home must give a copy to the resident and the next of kin, designee, or guardian at admission.",
      "entitled, important document, at their convenience",
    ],
  ),
  passes(
    "Assisted living disclosure (198.073.8)",
    [
      "All Missouri assisted living homes are fully transparent about what they offer.",
      "Every Missouri assisted living facility must tell a prospective resident what services it can provide and what they cost.",
      "fully transparent",
    ],
    [
      "Every Missouri assisted living facility must tell a prospective resident what services it can provide and what they cost.",
      "Every Missouri assisted living facility must also tell a prospective resident what services it can provide, what they cost, and which conditions would require a move (section 198.073.8).",
      "(added the discharge conditions the statute names)",
    ],
  ),
  passes(
    "What should I ask a Missouri home?",
    [
      "Arm yourself with these must-ask questions before you commit.",
      "Ask for the Alzheimer's special care disclosure the home filed with DHSS.",
      "arm yourself, must-ask, commit",
    ],
    [
      "Find out if the home is equipped for residents with advanced needs.",
      "Ask whether the license is ALF**, and how many staff are awake overnight. Ask to see the evacuation plan that would go into your family member's service plan.",
      "equipped, advanced needs",
    ],
  ),
  passes(
    "Common questions",
    [
      "Missouri licenses memory care through two programs.",
      "Not as a separate license. A home that offers an Alzheimer's special care unit or program must file a disclosure with the state.",
      "licenses memory care, programs",
    ],
    [
      "A home whose name says memory care is usually a safe bet.",
      "Not necessarily. We count a home only when the state file lists the disclosure or the ALF** license.",
      "usually a safe bet",
    ],
  ),
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
