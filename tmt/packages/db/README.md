# TMT database package

This package owns the M0 Supabase migration, fictional seed data, RLS tests,
and shared TypeScript database types. The browser must never receive a
service-role key. Anonymous access is denied and authenticated reads are
authorized from `public.profiles.id = auth.uid()` with a `dispatcher` or
`admin` role.

## Verification

Static invariant tests run without a database:

```bash
pnpm --filter @tmt/db test
```

Live SQL verification requires Docker and a current Supabase CLI. TMT CI runs
this gate against a database-only local Supabase stack on every pull request.
To reproduce it from the `tmt/` directory:

```bash
pnpm dlx supabase@2.122.0 start --workdir packages/db
pnpm dlx supabase@2.122.0 db reset --workdir packages/db
pnpm dlx supabase@2.122.0 test db --workdir packages/db
pnpm dlx supabase@2.122.0 db reset --workdir packages/db
pnpm dlx supabase@2.122.0 test db --workdir packages/db
pnpm dlx supabase@2.122.0 gen types typescript --local --workdir packages/db \
  > /tmp/tmt-database.types.ts \
  && mv /tmp/tmt-database.types.ts packages/db/src/database.types.ts
pnpm --filter @tmt/db typecheck
```

The second reset/test pair is the repeatability check. It must complete from a
clean database, load the seed again without conflicts, prove anonymous and
non-ops denial, prove dispatcher reads, and prove dispatcher client writes are
denied. Type generation must happen only after that clean migration succeeds.

The cloud worker itself has no Docker daemon, so the authoritative live result
is the TMT CI database step. Static tests do not replace it and no in-memory or
fake SQL engine is used.
