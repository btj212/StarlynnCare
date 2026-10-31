export const OREGON_DESIGNATION = {
  path: "/oregon/is-it-licensed-for-memory-care",
  title: "Is this Oregon home endorsed for memory care?",
  description:
    "Oregon bars a home from advertising memory care until DHS grants the endorsement. The page counts homes the state file lists as endorsed and says how to check the license.",
  datePublished: "2026-10-31",
  image: {
    src: "/illustrations/oregon-memory-care-endorsement.png",
    alt: "Illustrated wooden garden gate standing open onto a path, with climbing roses and no sign — standing in for the endorsement a home must have before it advertises memory care",
  },
  faq: [
    {
      q: "Does an Oregon memory care endorsement mean the home is good?",
      a: "No. Oregon's rules say an endorsement is not a recommendation by the Department. It means the home met the memory care rules and its license rules when DHS reviewed it. The home's inspection record shows how it has done since.",
    },
    {
      q: "Can an Oregon home without the endorsement advertise memory care?",
      a: "No. ORS 443.886 and OAR 411-057-0130 bar a facility from advertising itself as a memory care community or an Alzheimer's care unit without the endorsement.",
    },
    {
      q: "Which Oregon facilities can get a memory care endorsement?",
      a: "Residential care facilities, assisted living facilities, and nursing facilities. The endorsement is added to the facility's existing license.",
    },
    {
      q: "How often are endorsed Oregon homes inspected?",
      a: "On the schedule of their underlying license. Oregon surveys assisted living and residential care facilities every 24 months under OAR 411-054-0105, and DHS also inspects after complaints.",
    },
    {
      q: "What must an Oregon home do if a resident leaves the memory care unit?",
      a: "Under the temporary rules in effect from August 11 to December 27, 2026, the home must call 911 or local police after a first search, and notify DHS, the Long-Term Care Ombudsman, and the resident's representative within 24 hours.",
    },
  ],
} as const;

export const PENNSYLVANIA_DESIGNATION = {
  path: "/pennsylvania/is-it-licensed-for-memory-care",
  title: "Is this Pennsylvania home licensed for memory care?",
  description:
    "Pennsylvania lists a secured dementia care unit on a personal care home and special care on an assisted living residence. The page counts both and links the rules.",
  datePublished: "2026-10-31",
  image: {
    src: "/illustrations/pennsylvania-memory-care-designation.png",
    alt: "Illustrated hallway with a closed door and a window seat — standing in for the two Pennsylvania names for a dementia unit",
  },
  faq: [
    {
      q: "Does Pennsylvania have a memory care license?",
      a: "Not by that name. A personal care home can run a secured dementia care unit, and an assisted living residence can run a special care unit. The Department of Human Services inspects and approves either unit before it opens.",
    },
    {
      q: "What is the difference between a secured dementia care unit and a special care unit?",
      a: "The license. A secured dementia care unit is part of a personal care home (55 Pa. Code § 2600.231). A special care unit is part of an assisted living residence (§ 2800.231). Chapter 2800 also covers special care units for intense neurobehavioral rehabilitation.",
    },
    {
      q: "Does DHS inspect a dementia unit before it opens?",
      a: "Yes. DHS inspects and approves the unit before it operates, and again before a change to its capacity, locks, exit doors, or floor plan (§ 2600.239 and § 2800.239).",
    },
    {
      q: "Can a resident without dementia live in a secured dementia care unit?",
      a: "Yes, if the resident wants to. Section 2600.231(g) requires a medical evaluation, and the resident must be able to use the keypad or other device that opens the unit's doors.",
    },
    {
      q: "Which agency licenses Pennsylvania personal care homes?",
      a: "The Department of Human Services, not the Department of Health.",
    },
  ],
} as const;

export const MISSOURI_DESIGNATION = {
  path: "/missouri/is-it-licensed-for-memory-care",
  title: "Is this Missouri home licensed for memory care?",
  description:
    "Missouri has no standalone memory care license. The page counts Alzheimer's special care unit disclosures and ALF** licenses, and links the statutes.",
  datePublished: "2026-10-31",
  image: {
    src: "/illustrations/missouri-memory-care-designation.png",
    alt: "Illustrated porch with two empty chairs and a closed folder — standing in for Missouri's disclosure filing, not a separate memory care license",
  },
  faq: [
    {
      q: "Does Missouri license memory care?",
      a: "Not as a separate license. A home that offers an Alzheimer's special care unit or program must file a disclosure with the state (RSMo 198.510). An assisted living facility that keeps residents who cannot evacuate on their own holds a license the state file marks ALF** (RSMo 198.073.6).",
    },
    {
      q: "What is an ALF** license in Missouri?",
      a: "It marks an assisted living facility that keeps a resident who cannot safely evacuate with minimal help. The facility must keep enough staff awake around the clock to help with evacuation, and put an evacuation plan in that resident's service plan.",
    },
    {
      q: "What must a Missouri Alzheimer's special care disclosure include?",
      a: "How the unit differs from the rest of the facility in nine areas: philosophy and mission, placement and discharge, assessment and care planning, staff training, the physical environment, activities, family involvement, costs and fees, and safety and security.",
    },
    {
      q: "Does the state check the disclosure?",
      a: "Yes. Section 198.510 says the licensing department verifies the disclosure for accuracy as part of license renewal. The home must give a copy to the resident and next of kin at admission.",
    },
    {
      q: "If a Missouri home's name says memory care, does it have either filing?",
      a: "Not necessarily. We count a home only when the state file lists the disclosure or the ALF** license.",
    },
  ],
} as const;

export const TEXAS_DESIGNATION = {
  path: "/texas/is-it-licensed-for-memory-care",
  title: "Is this Texas home certified for Alzheimer's care?",
  description:
    "Texas requires an Alzheimer's certification before a home advertises specialized Alzheimer's care. The page counts homes HHSC lists as certified and links the rule.",
  datePublished: "2026-10-31",
  image: {
    src: "/illustrations/texas-alzheimer-certification.png",
    alt: "Illustrated courtyard bench under a tree — standing in for the certificate a Texas home must post if it advertises Alzheimer's care",
  },
} as const;
