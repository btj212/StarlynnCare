import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261101190000_m0_data_layer.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();
const seed = readFileSync(
  new URL("../supabase/seed.sql", import.meta.url),
  "utf8",
).toLowerCase();

const tables = [
  "profiles",
  "callers",
  "providers",
  "calls",
  "utterances",
  "consents",
  "handoff_events",
  "escalations",
] as const;

describe("M0 migration invariants", () => {
  it("creates every M0 table and enables RLS on each one", () => {
    for (const table of tables) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(`create policy ${table}_ops_read`);
    }
  });

  it("authorizes ops from auth.uid-bound profiles, never user metadata", () => {
    expect(migration).toContain("where id = (select auth.uid())");
    expect(migration).toContain("role in ('dispatcher', 'admin')");
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("create function private.is_ops_user()");
    expect(migration).not.toContain("create function public.is_ops_user()");
    expect(migration).toContain("using ((select private.is_ops_user()))");
    expect(migration).not.toContain("user_metadata");
    expect(migration).not.toContain("raw_app_meta_data");
    expect(migration).not.toMatch(
      /create policy[\s\S]*?for (insert|update|delete|all)/,
    );
    expect(migration).toContain(
      "revoke all on table public.calls from anon, authenticated",
    );
    expect(migration).toContain(
      "grant select on table public.calls to authenticated",
    );
  });

  it("includes callback consent and idempotent realtime publication", () => {
    expect(migration).toMatch(
      /create type public\.consent_kind[\s\S]*?'callback'/,
    );
    expect(migration).toContain("pg_publication_tables");
    expect(migration).toContain(
      "alter publication supabase_realtime add table public.%i",
    );
    for (const table of [
      "calls",
      "utterances",
      "consents",
      "handoff_events",
      "escalations",
    ]) {
      expect(migration).toContain(`'${table}'`);
    }
  });
});

describe("fictional seed invariants", () => {
  it("uses only reserved 555-0100 through 555-0199 phone numbers", () => {
    const phoneNumbers = seed.match(/\+[0-9]{11}/g) ?? [];
    expect(phoneNumbers.length).toBeGreaterThan(0);

    for (const phone of phoneNumbers) {
      expect(phone.slice(-7, -4)).toBe("555");
      const fictionalLine = Number(phone.slice(-4));
      expect(fictionalLine).toBeGreaterThanOrEqual(100);
      expect(fictionalLine).toBeLessThanOrEqual(199);
    }
  });

  it("marks people and providers as fictional and supports callback consent", () => {
    expect(seed).toContain("(fictional)");
    expect(seed).toContain("fictional valley steer tire");
    expect(seed).toContain("'callback'");
    expect(seed).toContain("@example.test");
    for (const table of [
      "profiles",
      "callers",
      "providers",
      "calls",
      "utterances",
      "handoff_events",
      "escalations",
    ]) {
      expect(seed).toContain(`insert into public.${table}`);
    }
  });

  it("makes every seed insert repeatable", () => {
    const inserts = seed.match(/insert into[\s\S]*?;/g) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    for (const insert of inserts) {
      expect(insert).toContain("on conflict");
    }
  });
});
