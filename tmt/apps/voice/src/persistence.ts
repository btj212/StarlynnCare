import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Language } from "@tmt/contracts";
import type { Database } from "@tmt/db";

export type VoiceCallStatus =
  | "in_progress"
  | "handoff_requested"
  | "handoff_in_progress"
  | "completed"
  | "failed";
export type VoiceHandoffTrigger =
  | "dtmf_zero"
  | "spoken_request"
  | "agent_escalation"
  | "session_end"
  | "system_error";

export interface VoiceCall {
  readonly id: string;
  readonly twilioCallSid: string;
  readonly language: Language;
  readonly recordingNoticePlayed: boolean;
}

export interface NewVoiceCall {
  readonly twilioCallSid: string;
  readonly fromE164: string;
  readonly toE164: string;
  readonly language: Language;
  readonly recordingNoticePlayed: boolean;
}

export interface NewUtterance {
  readonly callId: string;
  readonly externalEventId: string;
  readonly sequenceNumber: number;
  readonly speaker: "caller" | "agent";
  readonly language: Language;
  readonly text: string;
  readonly isFinal: boolean;
  readonly interrupted: boolean;
  readonly startedAt: string;
  readonly endedAt: string;
}

export interface NewHandoff {
  readonly callId: string;
  readonly idempotencyKey: string;
  readonly trigger: VoiceHandoffTrigger;
  readonly reason: string;
  readonly targetE164: string;
}

export interface VoicePersistence {
  upsertCall(input: NewVoiceCall): Promise<VoiceCall>;
  findCallBySid(twilioCallSid: string): Promise<VoiceCall | undefined>;
  updateCall(
    callId: string,
    update: {
      readonly status: VoiceCallStatus;
      readonly endedAt?: string;
      readonly handoffReason?: string;
    },
  ): Promise<void>;
  appendUtterance(input: NewUtterance): Promise<void>;
  markLastAgentUtteranceInterrupted(
    callId: string,
    endedAt: string,
  ): Promise<void>;
  recordHandoff(input: NewHandoff): Promise<void>;
}

interface MemoryCall extends VoiceCall {
  status: VoiceCallStatus;
  endedAt: string | undefined;
  handoffReason: string | undefined;
}

interface MemoryHandoff extends NewHandoff {
  readonly id: string;
}

function deterministicUuid(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

export class InMemoryVoicePersistence implements VoicePersistence {
  readonly calls: MemoryCall[] = [];
  readonly utterances: NewUtterance[] = [];
  readonly handoffs: MemoryHandoff[] = [];
  private nextId = 1;

  upsertCall(input: NewVoiceCall): Promise<VoiceCall> {
    const existing = this.calls.find(
      (call) => call.twilioCallSid === input.twilioCallSid,
    );
    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    const call: MemoryCall = {
      id: deterministicUuid(this.nextId++),
      twilioCallSid: input.twilioCallSid,
      language: input.language,
      recordingNoticePlayed: input.recordingNoticePlayed,
      status: "in_progress",
      endedAt: undefined,
      handoffReason: undefined,
    };
    this.calls.push(call);
    return Promise.resolve(call);
  }

  findCallBySid(twilioCallSid: string): Promise<VoiceCall | undefined> {
    return Promise.resolve(
      this.calls.find((call) => call.twilioCallSid === twilioCallSid),
    );
  }

  updateCall(
    callId: string,
    update: {
      readonly status: VoiceCallStatus;
      readonly endedAt?: string;
      readonly handoffReason?: string;
    },
  ): Promise<void> {
    const call = this.calls.find((candidate) => candidate.id === callId);
    if (call === undefined) {
      throw new Error(`Unknown call: ${callId}`);
    }
    call.status = update.status;
    call.endedAt = update.endedAt;
    call.handoffReason = update.handoffReason;
    return Promise.resolve();
  }

  appendUtterance(input: NewUtterance): Promise<void> {
    if (
      this.utterances.some(
        (utterance) =>
          utterance.callId === input.callId &&
          (utterance.externalEventId === input.externalEventId ||
            utterance.sequenceNumber === input.sequenceNumber),
      )
    ) {
      return Promise.resolve();
    }
    this.utterances.push(input);
    return Promise.resolve();
  }

  markLastAgentUtteranceInterrupted(
    callId: string,
    endedAt: string,
  ): Promise<void> {
    const utterance = this.utterances
      .filter(
        (candidate) =>
          candidate.callId === callId && candidate.speaker === "agent",
      )
      .at(-1);
    if (utterance !== undefined) {
      const index = this.utterances.indexOf(utterance);
      this.utterances[index] = {
        ...utterance,
        interrupted: true,
        endedAt,
      };
    }
    return Promise.resolve();
  }

  recordHandoff(input: NewHandoff): Promise<void> {
    if (
      this.handoffs.some(
        (handoff) => handoff.idempotencyKey === input.idempotencyKey,
      )
    ) {
      return Promise.resolve();
    }
    this.handoffs.push({
      ...input,
      id: deterministicUuid(this.nextId++),
    });
    return Promise.resolve();
  }
}

export class SupabaseVoicePersistence implements VoicePersistence {
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upsertCall(input: NewVoiceCall): Promise<VoiceCall> {
    const { data, error } = await this.client
      .from("calls")
      .upsert(
        {
          twilio_call_sid: input.twilioCallSid,
          direction: "inbound",
          status: "in_progress",
          from_e164: input.fromE164,
          to_e164: input.toE164,
          language: input.language,
          recording_notice_played: input.recordingNoticePlayed,
        },
        { onConflict: "twilio_call_sid" },
      )
      .select("id, twilio_call_sid, language, recording_notice_played")
      .single();
    if (error !== null) {
      throw new Error(`Failed to upsert call: ${error.message}`);
    }
    return {
      id: data.id,
      twilioCallSid: data.twilio_call_sid,
      language: data.language,
      recordingNoticePlayed: data.recording_notice_played,
    };
  }

  async findCallBySid(
    twilioCallSid: string,
  ): Promise<VoiceCall | undefined> {
    const { data, error } = await this.client
      .from("calls")
      .select("id, twilio_call_sid, language, recording_notice_played")
      .eq("twilio_call_sid", twilioCallSid)
      .maybeSingle();
    if (error !== null) {
      throw new Error(`Failed to find call: ${error.message}`);
    }
    return data === null
      ? undefined
      : {
          id: data.id,
          twilioCallSid: data.twilio_call_sid,
          language: data.language,
          recordingNoticePlayed: data.recording_notice_played,
        };
  }

  async updateCall(
    callId: string,
    update: {
      readonly status: VoiceCallStatus;
      readonly endedAt?: string;
      readonly handoffReason?: string;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from("calls")
      .update({
        status: update.status,
        ...(update.endedAt === undefined ? {} : { ended_at: update.endedAt }),
        ...(update.handoffReason === undefined
          ? {}
          : { handoff_reason: update.handoffReason }),
      })
      .eq("id", callId);
    if (error !== null) {
      throw new Error(`Failed to update call: ${error.message}`);
    }
  }

  async appendUtterance(input: NewUtterance): Promise<void> {
    const { error } = await this.client.from("utterances").insert({
      call_id: input.callId,
      external_event_id: input.externalEventId,
      sequence_number: input.sequenceNumber,
      speaker: input.speaker,
      lang: input.language,
      text_original: input.text,
      is_final: input.isFinal,
      interrupted: input.interrupted,
      started_at: input.startedAt,
      ended_at: input.endedAt,
    });
    if (error !== null && error.code !== "23505") {
      throw new Error(`Failed to persist utterance: ${error.message}`);
    }
  }

  async markLastAgentUtteranceInterrupted(
    callId: string,
    endedAt: string,
  ): Promise<void> {
    const { data, error } = await this.client
      .from("utterances")
      .select("id")
      .eq("call_id", callId)
      .eq("speaker", "agent")
      .order("sequence_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) {
      throw new Error(`Failed to find interrupted utterance: ${error.message}`);
    }
    if (data === null) {
      return;
    }
    const { error: updateError } = await this.client
      .from("utterances")
      .update({ interrupted: true, ended_at: endedAt })
      .eq("id", data.id);
    if (updateError !== null) {
      throw new Error(
        `Failed to mark interrupted utterance: ${updateError.message}`,
      );
    }
  }

  async recordHandoff(input: NewHandoff): Promise<void> {
    const { error } = await this.client.from("handoff_events").upsert(
      {
        call_id: input.callId,
        idempotency_key: input.idempotencyKey,
        trigger: input.trigger,
        status: "attempted",
        reason: input.reason,
        target_e164: input.targetE164,
        attempted_at: new Date().toISOString(),
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
    if (error !== null) {
      throw new Error(`Failed to persist handoff: ${error.message}`);
    }
  }
}
