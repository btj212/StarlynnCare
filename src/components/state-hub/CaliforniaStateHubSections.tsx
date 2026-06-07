import type { CaliforniaStateHubData } from "@/lib/data/stateHub";
import { caStateConfig } from "@/lib/stateHubConfigs/ca";
import { StateHubSections } from "./StateHubSections";

type Props = {
  data: CaliforniaStateHubData;
};

/** Thin wrapper — delegates to the generic StateHubSections with the CA config. */
export function CaliforniaStateHubSections({ data }: Props) {
  return <StateHubSections data={data} config={caStateConfig} />;
}
