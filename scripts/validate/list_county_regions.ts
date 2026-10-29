import { regionsForState } from "../../src/lib/regions.ts";
import { COVERED_STATES } from "../../src/lib/states.ts";

const rows = [];
for (const state of COVERED_STATES) {
  for (const region of regionsForState(state.code)) {
    if (region.kind === "county") {
      rows.push({
        state: state.slug,
        slug: region.slug,
        cities: [...region.citySlugs],
      });
    }
  }
}
process.stdout.write(JSON.stringify(rows));
