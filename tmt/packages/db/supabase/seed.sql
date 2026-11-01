begin;

-- All identities and events below are fictional. Phone numbers use the
-- North American reserved fiction range 555-0100 through 555-0199.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000001001',
    'authenticated',
    'authenticated',
    'fictional.admin@example.test',
    extensions.crypt('fictional-seed-only', extensions.gen_salt('bf')),
    '2026-11-01T18:00:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"seed_fixture":true}'::jsonb,
    '2026-11-01T18:00:00Z',
    '2026-11-01T18:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000001002',
    'authenticated',
    'authenticated',
    'fictional.dispatcher@example.test',
    extensions.crypt('fictional-seed-only', extensions.gen_salt('bf')),
    '2026-11-01T18:00:00Z',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"seed_fixture":true}'::jsonb,
    '2026-11-01T18:00:00Z',
    '2026-11-01T18:00:00Z'
  )
on conflict (id) do update set
  email = excluded.email,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at;

insert into public.profiles (
  id,
  role,
  display_name,
  languages,
  phone_e164,
  on_call,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000001001',
    'admin',
    'Morgan Vale (Fictional)',
    array['en']::public.lang_code[],
    '+12095550100',
    false,
    '2026-11-01T18:00:00Z',
    '2026-11-01T18:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000001002',
    'dispatcher',
    'Nav Kaur (Fictional)',
    array['pa', 'hi', 'en']::public.lang_code[],
    '+12095550101',
    true,
    '2026-11-01T18:00:00Z',
    '2026-11-01T18:00:00Z'
  )
on conflict (id) do update set
  role = excluded.role,
  display_name = excluded.display_name,
  languages = excluded.languages,
  phone_e164 = excluded.phone_e164,
  on_call = excluded.on_call,
  updated_at = excluded.updated_at;

insert into public.callers (
  id,
  phone_e164,
  display_name,
  preferred_language,
  created_at,
  last_seen_at
)
values
  (
    '00000000-0000-4000-8000-000000002001',
    '+12095550110',
    'Jas Sandhu (Fictional)',
    'pa',
    '2026-11-01T18:05:00Z',
    '2026-11-01T18:10:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000002002',
    '+15595550111',
    'Elena Cruz (Fictional)',
    'es',
    '2026-11-01T18:05:00Z',
    '2026-11-01T18:12:00Z'
  )
on conflict (id) do update set
  phone_e164 = excluded.phone_e164,
  display_name = excluded.display_name,
  preferred_language = excluded.preferred_language,
  last_seen_at = excluded.last_seen_at;

insert into public.providers (
  id,
  business_name,
  contact_name,
  phone_e164,
  languages,
  categories,
  status,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000003001',
    'Fictional Valley Steer Tire',
    'Avery Shah (Fictional)',
    '+16615550120',
    array['pa', 'hi', 'en']::public.lang_code[],
    array['tires', 'mobile_repair']::public.service_category[],
    'active',
    '2026-11-01T18:05:00Z',
    '2026-11-01T18:05:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000003002',
    'Fictional 99 Heavy Recovery',
    'Riley Sol (Fictional)',
    '+15595550121',
    array['es', 'en']::public.lang_code[],
    array['towing', 'roadside_assistance']::public.service_category[],
    'active',
    '2026-11-01T18:05:00Z',
    '2026-11-01T18:05:00Z'
  )
on conflict (id) do update set
  business_name = excluded.business_name,
  contact_name = excluded.contact_name,
  phone_e164 = excluded.phone_e164,
  languages = excluded.languages,
  categories = excluded.categories,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into public.calls (
  id,
  caller_id,
  provider_id,
  twilio_call_sid,
  direction,
  status,
  from_e164,
  to_e164,
  language,
  started_at,
  ended_at,
  recording_notice_played,
  recording_path,
  ai_seconds,
  human_seconds,
  handoff_reason,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000004001',
    '00000000-0000-4000-8000-000000002001',
    null,
    'CA11111111111111111111111111111111',
    'inbound',
    'completed',
    '+12095550110',
    '+12095550130',
    'pa',
    '2026-11-01T18:10:00Z',
    '2026-11-01T18:14:00Z',
    false,
    null,
    180,
    60,
    'caller requested a dispatcher',
    '2026-11-01T18:10:00Z',
    '2026-11-01T18:14:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000004002',
    '00000000-0000-4000-8000-000000002002',
    null,
    'CA22222222222222222222222222222222',
    'inbound',
    'in_progress',
    '+15595550111',
    '+12095550131',
    'es',
    '2026-11-01T18:12:00Z',
    null,
    false,
    null,
    45,
    0,
    null,
    '2026-11-01T18:12:00Z',
    '2026-11-01T18:12:00Z'
  )
on conflict (id) do update set
  status = excluded.status,
  ended_at = excluded.ended_at,
  ai_seconds = excluded.ai_seconds,
  human_seconds = excluded.human_seconds,
  handoff_reason = excluded.handoff_reason,
  updated_at = excluded.updated_at;

insert into public.utterances (
  id,
  call_id,
  external_event_id,
  sequence_number,
  speaker,
  lang,
  text_original,
  text_en,
  confidence,
  is_final,
  interrupted,
  started_at,
  ended_at,
  created_at
)
values
  (
    '00000000-0000-4000-8000-000000005001',
    '00000000-0000-4000-8000-000000004001',
    'fictional-relay-event-1',
    1,
    'agent',
    'pa',
    'ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ। ਮੈਂ TMT ਦੀ AI ਡਿਸਪੈਚਰ ਹਾਂ।',
    'Hello. I am TMT''s AI dispatcher.',
    null,
    true,
    false,
    '2026-11-01T18:10:01Z',
    '2026-11-01T18:10:04Z',
    '2026-11-01T18:10:04Z'
  ),
  (
    '00000000-0000-4000-8000-000000005002',
    '00000000-0000-4000-8000-000000004001',
    'fictional-relay-event-2',
    2,
    'caller',
    'pa',
    'ਮੈਂ ਸੁਰੱਖਿਅਤ ਥਾਂ ਤੇ ਹਾਂ।',
    'I am in a safe place.',
    0.96,
    true,
    false,
    '2026-11-01T18:10:05Z',
    '2026-11-01T18:10:08Z',
    '2026-11-01T18:10:08Z'
  ),
  (
    '00000000-0000-4000-8000-000000005003',
    '00000000-0000-4000-8000-000000004002',
    'fictional-relay-event-3',
    1,
    'caller',
    'es',
    'Estoy fuera del camino y necesito ayuda con una llanta.',
    'I am off the road and need tire help.',
    0.94,
    true,
    false,
    '2026-11-01T18:12:03Z',
    '2026-11-01T18:12:07Z',
    '2026-11-01T18:12:07Z'
  )
on conflict (id) do update set
  text_original = excluded.text_original,
  text_en = excluded.text_en,
  confidence = excluded.confidence,
  is_final = excluded.is_final,
  interrupted = excluded.interrupted,
  ended_at = excluded.ended_at;

insert into public.consents (
  id,
  call_id,
  subject_type,
  subject_id,
  kind,
  granted,
  source,
  evidence,
  created_at,
  revoked_at
)
values (
  '00000000-0000-4000-8000-000000006001',
  '00000000-0000-4000-8000-000000004001',
  'caller',
  '00000000-0000-4000-8000-000000002001',
  'callback',
  true,
  'voice',
  '{"utterance_id":"00000000-0000-4000-8000-000000005002","twilio_call_sid":"CA11111111111111111111111111111111"}'::jsonb,
  '2026-11-01T18:10:09Z',
  null
)
on conflict (id) do update set
  granted = excluded.granted,
  evidence = excluded.evidence,
  revoked_at = excluded.revoked_at;

insert into public.handoff_events (
  id,
  call_id,
  idempotency_key,
  trigger,
  status,
  reason,
  target_e164,
  requested_at,
  attempted_at,
  connected_at,
  completed_at,
  failure_code,
  created_at
)
values (
  '00000000-0000-4000-8000-000000007001',
  '00000000-0000-4000-8000-000000004001',
  'fictional-handoff-CA11111111111111111111111111111111-1',
  'dtmf_zero',
  'connected',
  'caller requested a dispatcher',
  '+12095550101',
  '2026-11-01T18:13:00Z',
  '2026-11-01T18:13:01Z',
  '2026-11-01T18:13:05Z',
  '2026-11-01T18:14:00Z',
  null,
  '2026-11-01T18:13:00Z'
)
on conflict (id) do update set
  status = excluded.status,
  attempted_at = excluded.attempted_at,
  connected_at = excluded.connected_at,
  completed_at = excluded.completed_at,
  failure_code = excluded.failure_code;

insert into public.escalations (
  id,
  call_id,
  reason,
  priority,
  status,
  assigned_to,
  created_at,
  resolved_at,
  resolution_note
)
values (
  '00000000-0000-4000-8000-000000008001',
  '00000000-0000-4000-8000-000000004001',
  'caller requested a dispatcher',
  'p2',
  'resolved',
  '00000000-0000-4000-8000-000000001002',
  '2026-11-01T18:13:00Z',
  '2026-11-01T18:14:00Z',
  'Fictional dispatcher accepted the transfer.'
)
on conflict (id) do update set
  status = excluded.status,
  assigned_to = excluded.assigned_to,
  resolved_at = excluded.resolved_at,
  resolution_note = excluded.resolution_note;

commit;
