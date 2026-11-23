# ADR 0003: Start voice transport with Twilio ConversationRelay

- Status: Accepted
- Date: 2026-11-01

## Context

The thin slice needs inbound telephony, speech recognition, speech synthesis,
barge-in, language switching, and DTMF without building an audio pipeline.
Punjabi quality in roadside noise is an acknowledged product risk.

## Decision

Use Twilio ConversationRelay first. Twilio handles the phone and audio layers;
`apps/voice` exchanges text events over a WebSocket and validates Twilio
signatures before accepting webhooks.

Language configuration covers English, Punjabi, Hindi, and Spanish. Exact
TwiML attributes, WebSocket messages, voices, and speech providers must be
checked against current Twilio documentation during implementation.

The dispatcher brain remains transport-independent and text-in/text-out.
ConversationRelay-specific adaptation stays in `apps/voice`, while contracts,
policies, and evals stay in shared packages. If native-speaker testing finds
Punjabi unacceptable, a Pipecat transport with Sarvam or Soniox may replace
the adapter without replacing the brain.

## Consequences

- M0 avoids custom audio engineering and can test a real call path sooner.
- The long-lived voice service cannot use a request-only serverless runtime; it
  will deploy to a suitable US-West service such as Fly.io or Render.
- ConversationRelay remains behind an adapter because its public interface can
  change.
- No production voice is selected until a native-speaker bake-off uses
  consented clips with realistic road noise.
- Automated tests replay mocked events and never place a real call.
