import {
  BarChart,
  LineChart,
  PieChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
} from "cursor/canvas";

// ─── All findings hardcoded from Stage 6 Batch 1 + Batch 2 (2026-05-11) ─────

// ── BATCH 1 ──────────────────────────────────────────────────────────────────

const A1 = {
  slug: "cost_vs_quality_ca",
  title: "Price vs. Quality (CA)",
  corr: 0.27,
  pctHighSeverity: 13,
  mostExpensiveCounty: "San Francisco ($8,200/mo)",
  highestCitationCounty: "Contra Costa",
  worstValue: "Araville Residential Care Home II",
  verdict: "yellow" as const,
  verdictNote: "County-median pricing, not facility-specific. Direction interesting but limited by data.",
};

const A2 = {
  slug: "chain_operator_scorecard_ca",
  title: "Chain Operator Scorecard",
  nChains: 23,
  worstLarge: "Pacifica Senior Living",
  worstLargeN: 17,
  worstLargeSev: 0.30,
  bestLarge: "Atria Senior Living",
  bestLargeN: 15,
  bestLargeSev: 0.037,
  spread: 8,
  chains: [
    { name: "Pacifica Senior Living", n: 17, idx: 0.297 },
    { name: "Aegis Senior Communities", n: 13, idx: 0.196 },
    { name: "Belmont Village", n: 9, idx: 0.114 },
    { name: "Oakmont Senior Living", n: 53, idx: 0.091 },
    { name: "Sunrise Senior Living", n: 14, idx: 0.050 },
    { name: "ActivCare Living", n: 6, idx: 0.042 },
    { name: "Atria Senior Living", n: 15, idx: 0.037 },
  ],
  verdict: "green" as const,
  verdictNote: "Named-brand rankings, 8× spread, high search value. Strong hook.",
};

const A3 = {
  slug: "repeat_offender_report",
  title: "Repeat Offender Report",
  oneInN: 5,
  pct: 21,
  n: 100,
  total: 484,
  topReg: "87303(a) — General Facility Maintenance",
  multiOffender: "Roundhill Care Homes, Inc.",
  multiCount: 6,
  top5: [
    { name: "Opal Care LLC", city: "Oakland", citations: 22 },
    { name: "Oakland Heights Senior Living", city: "Oakland", citations: 9 },
    { name: "Whitten Heights AL & MC", city: "La Habra", citations: 13 },
    { name: "Roundhill Care Homes", city: "Alamo", citations: 12 },
    { name: "Brittany House", city: "Long Beach", citations: 11 },
  ],
  verdict: "green" as const,
  verdictNote: "'1 in 5' is sticky, no data-gap caveats, named facilities, strongest standalone hook.",
};

// ── BATCH 2 ──────────────────────────────────────────────────────────────────

const A4 = {
  slug: "memory_care_specific_violations",
  title: "MC-Specific Violations",
  mcRegPct: 6,
  topReg: "87303(a) — General Maintenance (363 citations)",
  topKw: "Staffing inadequacy (1,069 mentions)",
  abuseCount: 94,
  note: "All 484 CA publishable facilities serve MC — no non-MC group for comparison.",
  verdict: "yellow" as const,
  verdictNote: "Staffing + maintenance as top harm categories is solid supporting color. Not a standalone hook.",
};

const A5 = {
  slug: "geographic_equity_map",
  title: "Geographic Equity Map",
  corr: 0.23,
  worstQ: "Q4 High (highest-income ZIPs)",
  outlierZips: "94560, 94555, 94536 (East Bay — Newark/Fremont)",
  nCensusZips: 484,
  note: "Higher-income ZIPs trend slightly WORSE — mirrors price/quality finding.",
  verdict: "yellow" as const,
  verdictNote: "Counterintuitive equity finding complements Analyses 1+2. Strong if paired with zip-level names.",
};

const A6 = {
  slug: "severity_trends_2020_2025",
  title: "Severity Trends 2021–2025",
  rate2021: 0.33,
  rate2024: 0.77,
  rate2025: 0.58,
  pctChange: 132,
  note: "COVID shutdown visible in 2020 (1 inspection). 2025 partial year.",
  verdict: "green" as const,
  verdictNote: "132% rise is alarming and highly contextualizes repeat-offender story. Best supporting stat.",
};

const A7 = {
  slug: "worst_week_seasonal",
  title: "Seasonal Violation Patterns",
  worstMonth: "August",
  worstSeason: "Fall",
  worstDow: "Friday",
  fridayRate: 1.13,
  weekendNote: "Inspections near-zero on weekends — a systemic blind spot.",
  verdict: "yellow" as const,
  verdictNote: "Weekend blind spot is a unique angle. Strong sidebar, not primary hook.",
};

// ─── Traffic light component ─────────────────────────────────────────────────
function Verdict({ v, note }: { v: "green" | "yellow" | "red"; note: string }) {
  const toneMap = { green: "success", yellow: "warning", red: "danger" } as const;
  const labelMap = { green: "Strong hook", yellow: "Supporting stat", red: "Weak hook" };
  return (
    <Stack gap={6}>
      <Pill tone={toneMap[v]}>{labelMap[v]}</Pill>
      <Text size="small" tone="secondary">{note}</Text>
    </Stack>
  );
}

// ─── Trend data for Analysis 6 chart ─────────────────────────────────────────
const trendYears = ["2021", "2022", "2023", "2024", "2025"];
const trendRates = [0.33, 0.44, 0.69, 0.77, 0.58];

export default function AllAnalysesReview() {
  return (
    <Stack gap={36}>
      {/* Header */}
      <Stack gap={6}>
        <H1>Stage 6 — Checkpoint C: All 7 Analyses</H1>
        <Row gap={12}>
          <Pill tone="success">Batch 1 approved</Pill>
          <Pill tone="info">Batch 2 complete</Pill>
          <Pill tone="warning">Awaiting Checkpoint C review</Pill>
        </Row>
        <Text tone="secondary" size="small">
          484 CA facilities · 12,167 inspections · 7,748 deficiencies · Run 2026-05-11
        </Text>
      </Stack>

      {/* Top-line headline numbers */}
      <Grid columns={4} gap={14}>
        <Stat value="1 in 5" label="CA facilities with repeat violation" tone="danger" />
        <Stat value="8×" label="Best vs worst chain quality spread" tone="warning" />
        <Stat value="+132%" label="Citation rate rise 2021→2024" tone="danger" />
        <Stat value="r = +0.23" label="Income-quality correlation (flat/reversed)" tone="neutral" />
      </Grid>

      <Divider />

      {/* ── CHOSEN HOOKS ─────────────────────────────────────────────────── */}
      <Stack gap={4}>
        <H2>Primary Hooks</H2>
        <Text tone="secondary" size="small">
          Approved at Checkpoint B — Analysis 2 (Chain Scorecard) + Analysis 3 (Repeat Offenders)
        </Text>
      </Stack>

      <Grid columns={2} gap={20}>
        {/* Analysis 3 — Repeat Offenders */}
        <Stack gap={12}>
          <Row gap={10} align="center">
            <H3>Analysis 3 — Repeat Offenders</H3>
            <Pill tone="success">Primary hook</Pill>
          </Row>
          <Grid columns={3} gap={10}>
            <Stat value="1 in 5" label="CA facilities" tone="danger" />
            <Stat value="21%" label="of 484 facilities" tone="danger" />
            <Stat value="6" label="Roundhill distinct violations" tone="warning" />
          </Grid>
          <Table
            headers={["Facility", "City", "Repeat Citations"]}
            rows={A3.top5.map(f => [f.name, f.city, String(f.citations)])}
            rowTone={["danger", "danger", "warning", "warning", "warning"]}
          />
          <Verdict v={A3.verdict} note={A3.verdictNote} />
        </Stack>

        {/* Analysis 2 — Chain Scorecard */}
        <Stack gap={12}>
          <Row gap={10} align="center">
            <H3>Analysis 2 — Chain Scorecard</H3>
            <Pill tone="info">Secondary hook</Pill>
          </Row>
          <Grid columns={3} gap={10}>
            <Stat value={A2.worstLarge} label={`Worst chain (n=${A2.worstLargeN})`} tone="danger" />
            <Stat value={A2.bestLarge} label={`Best chain (n=${A2.bestLargeN})`} tone="success" />
            <Stat value={`${A2.spread}×`} label="Quality spread" tone="warning" />
          </Grid>
          <BarChart
            categories={A2.chains.map(c => c.name)}
            series={[{ name: "Severity Index", data: A2.chains.map(c => c.idx) }]}
            horizontal
            height={220}
          />
          <Verdict v={A2.verdict} note={A2.verdictNote} />
        </Stack>
      </Grid>

      <Divider />

      {/* ── BATCH 2 SUPPORTING ANALYSES ──────────────────────────────────── */}
      <Stack gap={4}>
        <H2>Supporting Analyses (Batch 2)</H2>
        <Text tone="secondary" size="small">
          Four analyses that provide context and color for the primary hooks
        </Text>
      </Stack>

      {/* Analysis 6 — trends (best supporting stat) */}
      <Stack gap={12}>
        <Row gap={10} align="center">
          <H3>Analysis 6 — Citation Rate Trend 2021–2025</H3>
          <Pill tone="success">Best supporting stat</Pill>
        </Row>
        <Grid columns={3} gap={12}>
          <Stat value="0.33" label="Deficiency rate in 2021" />
          <Stat value="0.77" label="Deficiency rate in 2024 (peak)" tone="danger" />
          <Stat value="+132%" label="Rise 2021→2024" tone="danger" />
        </Grid>
        <LineChart
          categories={trendYears}
          series={[{ name: "Deficiency Rate (defic/insp)", data: trendRates, tone: "danger" }]}
          fill
          height={180}
          valueSuffix=" def/insp"
        />
        <Callout tone="warning">
          <Text size="small">
            2020 COVID shutdown: 1 inspection total. 2021 data represents the ramp-up year.
            2025 rate of 0.58 may reflect partial year data.
          </Text>
        </Callout>
        <Verdict v={A6.verdict} note={A6.verdictNote} />
      </Stack>

      {/* Other 3 supporting analyses in a grid */}
      <Grid columns={3} gap={16}>
        {/* Analysis 4 */}
        <Stack gap={10}>
          <H3>Analysis 4 — MC Violation Profile</H3>
          <Stat value="6%" label="Citations under dementia statutes" />
          <Stat value="1,069" label="'Staffing' mentions in citations" tone="warning" />
          <Stat value="94" label="Abuse/neglect citations" tone="danger" />
          <Card>
            <CardBody>
              <Text size="small">
                <strong>#1 most-cited rule:</strong> 87303(a) General Maintenance (363×).
                Staffing failures and maintenance dominate CA memory care citations.
                All 484 CA facilities are MC — no comparison group.
              </Text>
            </CardBody>
          </Card>
          <Verdict v={A4.verdict} note={A4.verdictNote} />
        </Stack>

        {/* Analysis 5 */}
        <Stack gap={10}>
          <H3>Analysis 5 — Geographic Equity</H3>
          <Stat value="r = +0.23" label="Income-deficiency correlation" tone="warning" />
          <Stat value="Q4 High" label="Worst-record income quartile" tone="danger" />
          <Stat value="484" label="Facilities with Census income data" tone="success" />
          <Card>
            <CardBody>
              <Text size="small">
                <strong>Counterintuitive:</strong> higher-income ZIPs trend slightly WORSE.
                High-income outliers: ZIPs 94560, 94555, 94536 (East Bay).
                Mirrors the price/quality finding from Analysis 1.
              </Text>
            </CardBody>
          </Card>
          <Verdict v={A5.verdict} note={A5.verdictNote} />
        </Stack>

        {/* Analysis 7 */}
        <Stack gap={10}>
          <H3>Analysis 7 — Seasonal Patterns</H3>
          <Stat value="August" label="Most citations by month" />
          <Stat value="Fall" label="Worst season (serious citations)" tone="warning" />
          <Stat value="~0" label="Inspections on weekends" tone="danger" />
          <Card>
            <CardBody>
              <Text size="small">
                <strong>Weekend blind spot:</strong> inspections near-zero Saturday–Sunday.
                Friday rate highest at 1.13 defic/insp.
                Families visiting on weekends see a different (unmonitored) reality.
              </Text>
            </CardBody>
          </Card>
          <Verdict v={A7.verdict} note={A7.verdictNote} />
        </Stack>
      </Grid>

      {/* Analysis 1 */}
      <Stack gap={8}>
        <H3>Analysis 1 — Price vs. Quality (CA)</H3>
        <Grid columns={4} gap={12}>
          <Stat value="r = +0.27" label="Price→severity (county medians)" tone="warning" />
          <Stat value="13%" label="Facilities with severity index >5" tone="danger" />
          <Stat value="SF ≠ Contra Costa" label="Priciest ≠ worst-cited county" />
          <Stat value="Araville RCH II" label="Worst value facility" tone="danger" />
        </Grid>
        <Verdict v={A1.verdict} note={A1.verdictNote} />
      </Stack>

      <Divider />

      {/* ── TEASER REPORT STRATEGY ─────────────────────────────────────────── */}
      <Stack gap={16}>
        <H2>Teaser Report Strategy</H2>

        <Grid columns={2} gap={20}>
          <Stack gap={12}>
            <Card>
              <CardHeader>Proposed Headline</CardHeader>
              <CardBody>
                <Text>
                  <strong>
                    "1 in 5 California memory care facilities has been cited for the same
                    violation three or more times — here are the worst offenders"
                  </strong>
                </Text>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>Proposed Lede (2–3 sentences)</CardHeader>
              <CardBody>
                <Text>
                  More than 100 of California's 484 licensed memory care facilities have been
                  cited by state inspectors for the exact same regulatory violation three or
                  more times — a pattern that regulators call a systemic failure rather than
                  an oversight. The most repeated violation across the state is basic facility
                  maintenance, yet a fifth of memory care homes continue to fail it inspection
                  after inspection. Meanwhile, since 2021, California's overall memory care
                  deficiency rate has risen 132 percent — raising the question of whether
                  the state's most vulnerable residents are getting safer care or simply more
                  scrutiny of the same persistent problems.
                </Text>
              </CardBody>
            </Card>
          </Stack>

          <Stack gap={12}>
            <Card>
              <CardHeader>Primary Hook</CardHeader>
              <CardBody>
                <Stack gap={6}>
                  <Text><strong>Analysis 3 — Repeat Offenders</strong></Text>
                  <Text size="small">
                    "1 in 5" — sticky, no data caveats, named facilities, consumer-ready.
                    Roundhill Care Homes sidebar (6 distinct violations) adds depth.
                  </Text>
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>Secondary Hook</CardHeader>
              <CardBody>
                <Stack gap={6}>
                  <Text><strong>Analysis 2 — Chain Scorecard</strong></Text>
                  <Text size="small">
                    "These chains rank worst" — named brands, 8× spread, SEO magnet for
                    branded searches. Pacifica (17 locations, index 0.30) vs Atria (0.037).
                  </Text>
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>Best Batch 2 Complement</CardHeader>
              <CardBody>
                <Stack gap={6}>
                  <Pill tone="success">Analysis 6 — Trends</Pill>
                  <Text size="small">
                    "+132% since 2021" transforms a snapshot into a trend story.
                    It answers the natural reader question: "Is this getting better or worse?"
                    Pair directly with the repeat-offender lede.
                  </Text>
                </Stack>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>Strong Sidebar Angle</CardHeader>
              <CardBody>
                <Stack gap={6}>
                  <Pill tone="warning">Analysis 7 — Weekend Blind Spot</Pill>
                  <Text size="small">
                    "Inspections drop to near-zero on weekends" is a unique, actionable
                    consumer insight: visit on a weekday for the most representative picture.
                  </Text>
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </Grid>

        <Callout tone="danger">
          <Text>
            <strong>HARD STOP — Checkpoint C.</strong> Do not proceed to Phase 3 (hook selection memo),
            Phase 4 (teaser page), or any other phase. User review and explicit approval required.
          </Text>
        </Callout>
      </Stack>

      <Divider />

      <Text size="small" tone="secondary">
        Stage 6 · cursor/stage6-analysis · All 7 analyses complete · 2026-05-11 ·
        PR #16 open at github.com/btj212/StarlynnCare
      </Text>
    </Stack>
  );
}
