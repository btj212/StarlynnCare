begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'calls', 'calls table exists');
select has_table('public', 'utterances', 'utterances table exists');
select has_table('public', 'consents', 'consents table exists');
select has_schema('private', 'private schema exists');
select has_function(
  'private',
  'is_ops_user',
  array[]::text[],
  'RLS helper is private'
);
select hasnt_function(
  'public',
  'is_ops_user',
  array[]::text[],
  'RLS helper is not exposed in public'
);
select isnt_empty(
  $$select 1 from pg_policies where schemaname = 'public' and tablename = 'calls'$$,
  'calls has an RLS policy'
);

set local role anon;
select throws_ok(
  $$select * from public.calls$$,
  '42501',
  'permission denied for table calls',
  'anonymous users cannot read calls'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009999',
  true
);
select is_empty(
  $$select * from public.calls$$,
  'authenticated users without an ops profile cannot read calls'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001002',
  true
);
select results_eq(
  $$select count(*)::bigint from public.calls$$,
  $$values (2::bigint)$$,
  'dispatcher can read calls'
);
select results_eq(
  $$select count(*)::bigint from public.utterances$$,
  $$values (3::bigint)$$,
  'dispatcher can read utterances'
);
select throws_ok(
  $$delete from public.calls$$,
  '42501',
  'permission denied for table calls',
  'dispatcher client writes remain blocked'
);

select * from finish();
rollback;
