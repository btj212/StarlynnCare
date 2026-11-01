import type {
  CallRow,
  ConsentRow,
  EscalationRow,
  HandoffEventRow,
  UtteranceRow,
} from "@tmt/db";

export type RawOpsSnapshot = {
  calls: CallRow[];
  utterances: UtteranceRow[];
  consents: ConsentRow[];
  handoffEvents: HandoffEventRow[];
  escalations: EscalationRow[];
};

export type OpsCallCard = {
  call: CallRow;
  maskedCaller: string;
  utterances: UtteranceRow[];
  consents: ConsentRow[];
  latestHandoff: HandoffEventRow | null;
  activeEscalation: EscalationRow | null;
};

function newestFirst(left: string, right: string): number {
  return new Date(right).getTime() - new Date(left).getTime();
}

export function maskPhone(value: string): string {
  return `••• ••• ${value.slice(-4)}`;
}

export function mapOpsSnapshot(snapshot: RawOpsSnapshot): OpsCallCard[] {
  return [...snapshot.calls]
    .sort((left, right) => newestFirst(left.started_at, right.started_at))
    .map((call) => {
      const handoffs = snapshot.handoffEvents
        .filter((event) => event.call_id === call.id)
        .sort((left, right) =>
          newestFirst(left.requested_at, right.requested_at),
        );
      const escalations = snapshot.escalations
        .filter(
          (event) => event.call_id === call.id && event.status !== "resolved",
        )
        .sort((left, right) => newestFirst(left.created_at, right.created_at));

      return {
        call,
        maskedCaller: maskPhone(call.from_e164),
        utterances: snapshot.utterances
          .filter((utterance) => utterance.call_id === call.id)
          .sort(
            (left, right) => left.sequence_number - right.sequence_number,
          ),
        consents: snapshot.consents
          .filter((consent) => consent.call_id === call.id)
          .sort((left, right) =>
            newestFirst(left.created_at, right.created_at),
          ),
        latestHandoff: handoffs[0] ?? null,
        activeEscalation: escalations[0] ?? null,
      };
    });
}
