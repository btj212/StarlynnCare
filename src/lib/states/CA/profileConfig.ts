import type { StateProfileConfig } from "@/lib/states/profileConfig";
import { CA_RULEBOOK } from "./rulebook";
import { caFormatSeverityTag, caFormNameForDeficiency } from "./severity";

export const caProfileConfig: StateProfileConfig = {
  code: "CA",
  agencyShort: "CDSS",
  agencyLong: "California Dept. of Social Services · Community Care Licensing",
  citationPrefix: "22 CCR §",
  inspectionWindowMonths: 36,
  timelineWindowMonths: 24,
  formatSeverityTag: caFormatSeverityTag,
  formNameForDeficiency: caFormNameForDeficiency,
  rulebook: CA_RULEBOOK,
};
