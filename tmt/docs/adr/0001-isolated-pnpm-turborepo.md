# ADR 0001: Isolate TMT in a pnpm/Turborepo workspace

- Status: Accepted
- Date: 2026-11-01

## Context

TMT is being developed inside a repository that already contains a production
application with a different dependency graph, deployment lifecycle, and data
model. Sharing root tooling would couple releases and make an early TMT change
capable of breaking the legacy application.

TMT needs two deployable applications and several shared TypeScript packages.

## Decision

All TMT code, dependencies, build output, and documentation live under `tmt/`
as an independent pnpm workspace orchestrated by Turborepo. The workspace
contains `apps/web`, `apps/voice`, `packages/contracts`, `packages/db`,
`packages/agent`, and `packages/evals`.

The only root-level integration is `.github/workflows/tmt-ci.yml`. It uses path
filters so TMT CI runs for changes to `tmt/**` or its own workflow and does not
alter legacy CI.

TypeScript is strict in every workspace. Each workspace owns runnable
`lint`, `typecheck`, `test`, and `build` scripts; root scripts fan those commands
out through Turborepo.

## Consequences

- TMT and the legacy application can evolve and deploy independently.
- Commands must be run from `tmt/`, and TMT has its own lockfile.
- Shared code crosses TMT workspace package boundaries, never imports legacy
  application internals.
- Some repository-wide duplication is intentional because isolation is more
  valuable than sharing configuration across unrelated products.
