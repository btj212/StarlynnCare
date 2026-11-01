# ADR 0002: Use Supabase with deny-by-default row-level security

- Status: Accepted
- Date: 2026-11-01

## Context

TMT needs relational operational data, authentication for dispatchers,
real-time transcript updates, geospatial support, and auditable consent and
handoff events. Calls and transcripts contain sensitive operational and
location data. Browser clients must not gain broad database access.

## Decision

Use Supabase Postgres with PostGIS, Realtime, Auth, and Storage. Database
changes are versioned as SQL migrations in `packages/db`.

Row-level security is enabled on every application table. Policies are
deny-by-default:

- anonymous users cannot read operational calls, utterances, consent, or
  handoff records;
- authenticated dispatcher and admin access is granted only through explicit,
  role-aware policies;
- public token flows expose narrowly scoped server endpoints, not direct table
  access;
- the service-role key is server-only and never shipped to a browser;
- Realtime publication does not weaken the table's RLS policy.

Later migrations must include automated denial and authorized-access tests
from a clean database. Seeds contain only fictional identities and phone
numbers in the `555-0100` through `555-0199` range.

## Consequences

- Authorization remains enforced even if a client query is changed or
  compromised.
- Policy and migration review are required for every new table.
- Server processes may perform privileged writes, but must still validate
  external input and record audit events.
- Local and CI database verification arrives with the data-layer phase; this
  ADR does not create or connect to a Supabase project.
