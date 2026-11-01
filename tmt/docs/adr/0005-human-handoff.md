# ADR 0005: Keep immediate human handoff available

- Status: Accepted
- Date: 2026-11-01

## Context

Roadside incidents can be urgent, noisy, multilingual, and unsafe. The caller
must not be trapped in automation, and the model must not decide whether a
person is allowed to ask for human help.

## Decision

DTMF `0` and supported-language requests for a person or dispatcher trigger an
immediate, deterministic handoff. Agent safety escalation and end-session
handoff use the same audited server path.

The voice service records the reason and idempotent handoff event, ends the
ConversationRelay session with structured handoff data, and returns TwiML that
dials the configured on-call dispatcher. `ON_CALL_FALLBACK_E164` is the
explicit fallback destination.

The dispatcher receives a brief, privacy-minimized whisper with the caller's
language, issue, location summary, and open-job reference. If no dispatcher is
available, the system offers a callback, records callback consent, and pages
on-call; it never claims that a transfer succeeded when it did not.

## Consequences

- Handoff routing, retries, duplicate-event handling, and outcomes are
  deterministic and testable without a model.
- The UI must clearly distinguish requested, attempted, connected, failed, and
  callback states.
- Tests use mocked Twilio clients and fictional numbers; they never dial a real
  person.
- A configured and tested on-call destination is a live-launch requirement.
