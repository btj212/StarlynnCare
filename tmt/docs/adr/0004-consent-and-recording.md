# ADR 0004: Make consent auditable and recording opt-in by configuration

- Status: Accepted
- Date: 2026-11-01

## Context

TMT operates initially in California, where call recording requires all-party
consent. AI calls, SMS, WhatsApp, callbacks, recording, terms, and retention
for quality purposes have different legal and product meanings. A prompt alone
is not an auditable control.

## Decision

Every greeting discloses that the dispatcher is AI. Recording is disabled by
default and may occur only when `RECORDING_ENABLED=true`. When recording is
enabled, the localized greeting must include the approved recording notice and
the system must persist the resulting consent event and evidence.

Consent is channel- and purpose-specific. Later data contracts will represent
SMS, WhatsApp, callback, AI outbound call, recording, terms, and
data-for-quality consent separately, including source, timestamp, evidence,
and revocation or opt-out state.

No automated test records a call or contacts a real person. Recordings and
utterances use configured retention periods and are purged on schedule.
Quality clips may be retained only with explicit data-for-quality consent.

## Consequences

- Setting an environment flag alone is insufficient; the notice, consent
  persistence, and retention path must also pass tests before recording can be
  enabled.
- Missing, withdrawn, or ambiguous consent fails closed.
- Native-speaker and counsel review of localized notices is a launch gate.
- Consent checks are deterministic server-side policy, not a model judgment.
