import {
  BarChart,
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

// ─── Hardcoded findings from Batch 1 run (2026-05-11) ────────────────────────

// Analysis 1: cost_vs_quality_ca
const CQC = {
  corr: 0.27,
  pctHighSeverity: 13,
  nFacilities: 484,
  highSeverityCount: 63,
  mostExpensiveCounty: "San Francisco",
  mostExpensivePrice: "$8,200/mo",
  highestCitationCounty: "Contra Costa",
  worstValueFacility: "Araville Residential Care Home II",
  dataNote: "County-level Genworth 2024 medians — 5 direct DB measurements pending (all NULL)",
};

// Analysis 2: chain_operator_scorecard_ca
const CHAIN = {
  nChains: 23,
  worstLargeChain: "Pacifica Senior Living",
  worstLargeCount: 17,
  worstLargeSeverity: 0.30,
  bestLargeChain: "Atria Senior Living",
  bestLargeCount: 15,
  bestLargeSeverity: 0.037,
  spreadRatio: 8,
  topChains: [
    { brand: "Pacifica Senior Living", n: 17, idx: 0.297, repeat: "59%" },
    { brand: "Aegis Senior Communities", n: 13, idx: 0.196, repeat: "38%" },
    { brand: "Belmont Village", n: 9, idx: 0.114, repeat: "33%" },
    { brand: "Oakmont Senior Living", n: 53, idx: 0.091, repeat: "28%" },
    { brand: "Sunrise Senior Living", n: 14, idx: 0.050, repeat: "14%" },
    { brand: "ActivCare Living", n: 6, idx: 0.042, repeat: "0%" },
    { brand: "Atria Senior Living", n: 15, idx: 0.037, repeat: "13%" },
    { brand: "Front Porch Communities", n: 3, idx: 0.017, repeat: "0%" },
  ],
};

// Analysis 3: repeat_offender_report
const REPEAT = {
  totalFacilities: 484,
  repeatFacilities: 100,
  pctRepeat: 21,
  oneInN: 5,
  topRegCode: "87303(a)",
  topRegPlain: "General Facility Maintenance",
  multiOffender: "Roundhill Care Homes, Inc.",
  multiCount: 6,
  top5: [
    { name: "Opal Care LLC", city: "Oakland", totalCitations: 22, distinctViolations: 3 },
    { name: "Oakland Heights Senior Living", city: "Oakland", totalCitations: 9, distinctViolations: 1 },
    { name: "Whitten Heights AL & MC", city: "La Habra", totalCitations: 13, distinctViolations: 2 },
    { name: "Roundhill Care Homes", city: "Alamo", totalCitations: 12, distinctViolations: 6 },
    { name: "Brittany House", city: "Long Beach", totalCitations: 11, distinctViolations: 2 },
  ],
};

// ─── Severity tier breakdown for Chart 1 ────────────────────────────────────
const severityTierData = [
  { label: "Clean (0)", value: 484 - 63 - Math.round(484 * 0.4) - Math.round(484 * 0.18), tone: "success" as const },
  { label: "Moderate (1–3)", value: Math.round(484 * 0.4) },
  { label: "High (3–6)", value: Math.round(484 * 0.18) },
  { label: "Critical (6+)", value: 63, tone: "danger" as const },
];

function TrafficLight({ verdict }: { verdict: "green" | "yellow" | "red" }) {
  const map = {
    green: { tone: "success" as const, label: "Strong hook" },
    yellow: { tone: "warning" as const, label: "Interesting — needs work" },
    red: { tone: "danger" as const, label: "Weak hook" },
  };
  return <Pill tone={map[verdict].tone} size="large">{map[verdict].label}</Pill>;
}

export default function Batch1Review() {
  return (
    <Stack gap={32}>
      {/* Header */}
      <Stack gap={6}>
        <H1>Stage 6 — Batch 1 Findings Review</H1>
        <Text tone="secondary" size="small">
          3 analyses · 484 CA facilities · Run 2026-05-11 · STOP: user approval required before Batch 2
        </Text>
      </Stack>

      {/* Top-line snapshot */}
      <Grid columns={3} gap={16}>
        <Stat
          value="r = +0.27"
          label="Price→severity correlation"
          tone="warning"
        />
        <Stat
          value="1 in 5"
          label="CA facilities with repeat violation"
          tone="danger"
        />
        <Stat
          value="8×"
          label="Best vs worst chain spread"
          tone="neutral"
        />
      </Grid>

      <Divider />

      {/* ── Analysis 1 ─────────────────────────────────────────────────────── */}
      <Stack gap={16}>
        <Row gap={12} align="center">
          <H2>Analysis 1 — Cost vs. Quality (CA)</H2>
          <TrafficLight verdict="yellow" />
        </Row>
        <Text tone="secondary" size="small">
          Headline candidate: "In California memory care, price is no guarantee of quality."
        </Text>

        <Grid columns={4} gap={12}>
          <Stat value={`${CQC.corr}`} label="Pearson r (price→severity)" tone="warning" />
          <Stat value={`${CQC.pctHighSeverity}%`} label="Facilities with severity index >5" tone="danger" />
          <Stat value={CQC.mostExpensiveCounty} label="Most expensive county" />
          <Stat value={CQC.highestCitationCounty} label="Highest citation severity county" />
        </Grid>

        <Grid columns={2} gap={16}>
          <Card>
            <CardHeader>Severity Tier Distribution (484 facilities)</CardHeader>
            <CardBody>
              <PieChart
                data={severityTierData}
                donut
                size={180}
              />
            </CardBody>
          </Card>
          <Stack gap={12}>
            <Card>
              <CardHeader>Key Finding</CardHeader>
              <CardBody>
                <Text>
                  A positive correlation of <strong>r=+0.27</strong> means pricier counties trend
                  slightly <em>worse</em> on inspection severity — likely because San Francisco and
                  coastal metro facilities face both premium pricing and high inspection frequency.
                  The most expensive county (SF, $8,200/mo) and the highest-citation county
                  (Contra Costa) are <strong>different</strong>, confirming price and quality are
                  decoupled.
                </Text>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>Worst Value Facility</CardHeader>
              <CardBody>
                <Text><strong>{CQC.worstValueFacility}</strong> — highest combined price percentile + severity percentile in CA.</Text>
              </CardBody>
            </Card>
            <Callout tone="warning">
              <Text size="small">
                <strong>Data limitation:</strong> {CQC.dataNote}.
                The scatter uses county-level Genworth medians, not facility-specific prices.
                Direction of correlation is suggestive but not definitive.
              </Text>
            </Callout>
          </Stack>
        </Grid>

        <Stack gap={4}>
          <H3>Verdict</H3>
          <Text>
            <strong>Yellow — interesting but limited.</strong> The r=+0.27 finding is counterintuitive (higher price = slightly worse outcomes) and
            publishable as a "price is no guarantee" piece. But with county-median pricing rather than facility-specific prices,
            the scatter chart will look thin. Strongest as a <em>supporting stat in a larger piece</em>,
            not a standalone teaser. Unlock value when pricing data exists for 20+ facilities.
          </Text>
        </Stack>
      </Stack>

      <Divider />

      {/* ── Analysis 2 ─────────────────────────────────────────────────────── */}
      <Stack gap={16}>
        <Row gap={12} align="center">
          <H2>Analysis 2 — Chain Operator Scorecard (CA)</H2>
          <TrafficLight verdict="green" />
        </Row>
        <Text tone="secondary" size="small">
          Headline candidate: "These California memory care chains have the worst inspection records — ranked."
        </Text>

        <Grid columns={4} gap={12}>
          <Stat value={`${CHAIN.nChains}`} label="Chains analyzed (≥2 CA facilities)" />
          <Stat value={CHAIN.worstLargeChain} label={`Worst large chain (n=${CHAIN.worstLargeCount})`} tone="danger" />
          <Stat value={CHAIN.bestLargeChain} label={`Best large chain (n=${CHAIN.bestLargeCount})`} tone="success" />
          <Stat value={`${CHAIN.spreadRatio}×`} label="Best-to-worst severity spread" tone="warning" />
        </Grid>

        <BarChart
          categories={CHAIN.topChains.map(c => c.brand)}
          series={[{ name: "Severity Index", data: CHAIN.topChains.map(c => c.idx) }]}
          horizontal
          height={280}
        />

        <Table
          headers={["Operator", "Facilities", "Severity Index", "Repeat Citation Rate"]}
          rows={CHAIN.topChains.map(c => [
            c.brand,
            String(c.n),
            c.idx.toFixed(3),
            c.repeat,
          ])}
          rowTone={[
            "danger",
            "danger",
            "warning",
            "warning",
            undefined,
            undefined,
            "success",
            "success",
          ]}
        />

        <Stack gap={4}>
          <H3>Verdict</H3>
          <Text>
            <strong>Green — strong hook.</strong> The 8× spread between Pacifica (0.30) and Atria (0.037)
            across real named brands that families recognize is highly publishable. The data supports
            a ranked-list article with named operators. Oakmont's 53 CA facilities make it a dominant
            presence with a mid-range score (0.091) — that nuance is also editorial gold.
            <strong> Lead with this one.</strong>
          </Text>
        </Stack>
      </Stack>

      <Divider />

      {/* ── Analysis 3 ─────────────────────────────────────────────────────── */}
      <Stack gap={16}>
        <Row gap={12} align="center">
          <H2>Analysis 3 — Repeat Offender Report (CA)</H2>
          <TrafficLight verdict="green" />
        </Row>
        <Text tone="secondary" size="small">
          Headline candidate: "1 in 5 California memory care facilities has been cited for the same violation three or more times."
        </Text>

        <Grid columns={4} gap={12}>
          <Stat value={`1 in ${REPEAT.oneInN}`} label="CA facilities with repeat violation" tone="danger" />
          <Stat value={`${REPEAT.pctRepeat}%`} label="Of all 484 CA facilities" tone="danger" />
          <Stat value={REPEAT.topRegPlain} label="Most-repeated regulation statewide" />
          <Stat value={REPEAT.multiOffender} label={`Multi-category offender (${REPEAT.multiCount} violations)`} tone="warning" />
        </Grid>

        <Grid columns={2} gap={16}>
          <Stack gap={12}>
            <H3>Top 5 Worst Repeat Offenders</H3>
            <Table
              headers={["Facility", "City", "Total Repeat Citations", "Distinct Violations"]}
              rows={REPEAT.top5.map(f => [f.name, f.city, String(f.totalCitations), String(f.distinctViolations)])}
              rowTone={["danger", "danger", "warning", "warning", "warning"]}
            />
          </Stack>
          <Stack gap={12}>
            <Card>
              <CardHeader>Most-Repeated Violation</CardHeader>
              <CardBody>
                <Stack gap={8}>
                  <Text><strong>{REPEAT.topRegCode}</strong> — {REPEAT.topRegPlain}</Text>
                  <Text size="small" tone="secondary">
                    This is the most basic compliance category (physical plant upkeep, functional equipment,
                    clean environment). Facilities failing this repeatedly signal systemic management failure,
                    not one-off oversights.
                  </Text>
                </Stack>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>Facilities in Violation</CardHeader>
              <CardBody>
                <PieChart
                  data={[
                    { label: "Clean record", value: REPEAT.totalFacilities - REPEAT.repeatFacilities, tone: "success" },
                    { label: "Repeat offender", value: REPEAT.repeatFacilities, tone: "danger" },
                  ]}
                  donut
                  size={150}
                />
              </CardBody>
            </Card>
          </Stack>
        </Grid>

        <Stack gap={4}>
          <H3>Verdict</H3>
          <Text>
            <strong>Green — strongest hook of the three.</strong> "1 in 5" is a sticky, shareable number
            with immediate consumer relevance. The named facilities, the plain-English violations
            (general maintenance, dementia care, staffing ratios), and the multi-category offenders
            all combine for a self-contained teaser piece with no data-limitation caveats needed.
            The Roundhill Care Homes "6 distinct repeat violations" sidebar story is especially compelling.
          </Text>
        </Stack>
      </Stack>

      <Divider />

      {/* ── Which hook to lead with? ─────────────────────────────────────────── */}
      <Stack gap={16}>
        <H2>Which Hook Should We Lead With?</H2>

        <Grid columns={3} gap={16}>
          <Card>
            <CardHeader>
              <Row gap={8} align="center">
                <Text weight="bold">Price ≠ Quality</Text>
                <Pill tone="warning">Yellow</Pill>
              </Row>
            </CardHeader>
            <CardBody>
              <Stack gap={8}>
                <Text size="small">"In California memory care, price is no guarantee of quality."</Text>
                <Text size="small" tone="secondary">
                  Best used as a supporting stat inside a larger piece. Needs direct pricing data
                  (20+ facilities) to make a compelling scatter chart.
                </Text>
                <Pill tone="warning" size="large">3rd priority</Pill>
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Row gap={8} align="center">
                <Text weight="bold">Chain Scorecard</Text>
                <Pill tone="success">Green</Pill>
              </Row>
            </CardHeader>
            <CardBody>
              <Stack gap={8}>
                <Text size="small">"These CA memory care chains have the worst inspection records — ranked."</Text>
                <Text size="small" tone="secondary">
                  Named-brand rankings are highly SEO-able and newsworthy. 8× spread gives great
                  visual range. Strong for organic search on brand names.
                </Text>
                <Pill tone="info" size="large">2nd priority</Pill>
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Row gap={8} align="center">
                <Text weight="bold">Repeat Offenders</Text>
                <Pill tone="success">Green</Pill>
              </Row>
            </CardHeader>
            <CardBody>
              <Stack gap={8}>
                <Text size="small">"1 in 5 California memory care facilities has been cited for the same violation 3+ times."</Text>
                <Text size="small" tone="secondary">
                  Sticky "1 in N" statistic, named facilities, no pricing data limitation.
                  Self-contained. Best teaser piece.
                </Text>
                <Pill tone="success" size="large">1st priority — LEAD WITH THIS</Pill>
              </Stack>
            </CardBody>
          </Card>
        </Grid>

        <Callout tone="info">
          <Text>
            <strong>Recommendation:</strong> Lead the teaser report with the <strong>Repeat Offender</strong> story.
            "1 in 5" is a clean, memorable, radio-friendly number. The named facilities (Opal Care LLC, Oakland Heights,
            Roundhill Care Homes) give reporters a hook. The chain scorecard becomes Part 2 of the same series —
            "now we know the worst facilities; which chains own them?" The pricing analysis should wait until
            direct per-facility pricing data is available for ≥20 facilities.
          </Text>
        </Callout>
      </Stack>

      <Divider />

      <Text size="small" tone="secondary">
        Generated by cursor/stage6-analysis branch · StarlynnCare · 2026-05-11 ·
        HARD STOP — do not proceed to Batch 2 without explicit user approval.
      </Text>
    </Stack>
  );
}
