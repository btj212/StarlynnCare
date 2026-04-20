export const REVIEW_CATEGORIES = [
  {
    key: "staff_engagement" as const,
    label: "Staff Engagement",
    description: "How attentive, caring, and responsive the staff were day-to-day",
  },
  {
    key: "personal_care" as const,
    label: "Personal Care & Hygiene",
    description: "Bathing, grooming, dressing — the basics of daily dignity",
  },
  {
    key: "activities" as const,
    label: "Activities",
    description: "Quality and frequency of daily programming and engagement",
  },
  {
    key: "food" as const,
    label: "Food",
    description: "Meals, snacks, dietary accommodations, and the dining experience",
  },
  {
    key: "transparency" as const,
    label: "Transparency",
    description: "How openly the facility communicated about care, incidents, and changes",
  },
  {
    key: "safety" as const,
    label: "Safety & Medical Response",
    description: "Response to medical needs, fall prevention, and emergency handling",
  },
  {
    key: "night_weekend" as const,
    label: "Night & Weekend Quality",
    description: "Staffing and care quality outside of regular business hours",
  },
] as const;

export type CategoryKey = (typeof REVIEW_CATEGORIES)[number]["key"];

export const RELATIONSHIP_OPTIONS = [
  "Family member of current resident",
  "Family member of former resident",
  "Current resident",
  "Former resident",
  "Other",
] as const;

export const STAR_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};
