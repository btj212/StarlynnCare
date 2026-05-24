export { caStateConfig } from "./ca";
export { orStateConfig } from "./or";
export { waStateConfig } from "./wa";
export { mnStateConfig } from "./mn";
export { txStateConfig } from "./tx";
export { utStateConfig } from "./ut";
export { ilStateConfig } from "./il";
export type { StateHubConfig, EditorialCard, FaqItem } from "./types";
export { buildStateStatItems, buildStateStatFootnotes } from "./types";

import { caStateConfig } from "./ca";
import { orStateConfig } from "./or";
import { waStateConfig } from "./wa";
import { mnStateConfig } from "./mn";
import { txStateConfig } from "./tx";
import { utStateConfig } from "./ut";
import { ilStateConfig } from "./il";
import type { StateHubConfig } from "./types";

const CONFIGS: Record<string, StateHubConfig> = {
  california: caStateConfig,
  oregon: orStateConfig,
  washington: waStateConfig,
  minnesota: mnStateConfig,
  texas: txStateConfig,
  utah: utStateConfig,
  illinois: ilStateConfig,
};

/** Returns the rich hub config for a state slug, or null if only the thin index should render. */
export function getStateHubConfig(stateSlug: string): StateHubConfig | null {
  return CONFIGS[stateSlug] ?? null;
}
