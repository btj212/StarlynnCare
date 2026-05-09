export { caStateConfig } from "./ca";
export { orStateConfig } from "./or";
export { waStateConfig } from "./wa";
export { mnStateConfig } from "./mn";
export { txStateConfig } from "./tx";
export type { StateHubConfig, EditorialCard, FaqItem } from "./types";
export { buildStateStatItems, buildStateStatFootnotes } from "./types";

import { caStateConfig } from "./ca";
import { orStateConfig } from "./or";
import { waStateConfig } from "./wa";
import { mnStateConfig } from "./mn";
import { txStateConfig } from "./tx";
import type { StateHubConfig } from "./types";

const CONFIGS: Record<string, StateHubConfig> = {
  california: caStateConfig,
  oregon: orStateConfig,
  washington: waStateConfig,
  minnesota: mnStateConfig,
  texas: txStateConfig,
};

/** Returns the rich hub config for a state slug, or null if only the thin index should render. */
export function getStateHubConfig(stateSlug: string): StateHubConfig | null {
  return CONFIGS[stateSlug] ?? null;
}
