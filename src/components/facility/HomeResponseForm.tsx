"use client";

import Link from "next/link";
import { useState } from "react";
import { Honeypot } from "@/components/security/Honeypot";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD } from "@/lib/security/honeypot";
import {
  AUTHORIZED_TEXT,
  MOVE_OUT_REASONS,
  PHOTO_PERMISSION_TEXT,
  WANDERING_OPTIONS,
} from "@/lib/facility/homeResponse";

const input =
  "w-full rounded-[10px] border border-clearing-rule-2 bg-clearing-card px-3 py-2.5 text-[15px] text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";
const legend = "mb-2 block font-[family-name:var(--font-sans)] text-[15px] font-semibold text-ink";
const hint = "mb-3 text-[13px] leading-relaxed text-ink-3";
const card =
  "rounded-[16px] border border-clearing-rule-2 bg-clearing-card px-5 py-5 shadow-[var(--shadow-card)] md:px-6";

function Radio({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[15px] text-ink-2">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-[var(--color-teal)]"
      />
      {label}
    </label>
  );
}

export function HomeResponseForm({ facilityId, facilityName }: { facilityId: string; facilityName: string }) {
  const [memoryCare, setMemoryCare] = useState("");
  const [wandering, setWandering] = useState("");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [medicaid, setMedicaid] = useState("");
  const [program, setProgram] = useState("");
  const [staff, setStaff] = useState("");
  const [residents, setResidents] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [photoPermission, setPhotoPermission] = useState(false);
  const [photoLink, setPhotoLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleReason(value: string) {
    setReasons((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/home-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId,
          respondentName: name,
          respondentEmail: email,
          memoryCare,
          wandering,
          privatePayLow: low,
          privatePayHigh: high,
          medicaid,
          medicaidProgram: program,
          overnightStaff: staff,
          overnightResidents: residents,
          moveOutReasons: reasons,
          moveOutNote: note,
          authorized,
          photoPermission,
          photoLink,
          [HONEYPOT_FIELD]: (fd.get(HONEYPOT_FIELD) as string | null) ?? "",
          [HONEYPOT_TS_FIELD]: (fd.get(HONEYPOT_TS_FIELD) as string | null) ?? "",
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={card} role="status">
        <p className="m-0 font-[family-name:var(--font-display)] text-[24px] text-ink">Thank you.</p>
        <p className="mb-0 mt-2 text-[15px] leading-relaxed text-ink-2">
          We received the answers for {facilityName}. A person checks that they came from the home before they
          appear on the profile, usually within two business days. We will write to {email} if we have a question.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Honeypot />

      <fieldset className={card}>
        <legend className={legend}>Do you provide memory or dementia care at this address?</legend>
        <Radio name="mc" value="yes" label="Yes" checked={memoryCare === "yes"} onChange={setMemoryCare} />
        <Radio name="mc" value="no" label="No" checked={memoryCare === "no"} onChange={setMemoryCare} />
      </fieldset>

      <fieldset className={card}>
        <legend className={legend}>Can you take a resident with moderate dementia who wanders or becomes agitated?</legend>
        {WANDERING_OPTIONS.map((o) => (
          <Radio key={o.value} name="wander" value={o.value} label={o.label} checked={wandering === o.value} onChange={setWandering} />
        ))}
      </fieldset>

      <fieldset className={card}>
        <legend className={legend}>What is your monthly private-pay range?</legend>
        <p className={hint}>The lowest and highest typical monthly price for a resident, depending on care needs.</p>
        <div className="flex items-center gap-3">
          <input aria-label="Lowest monthly price" inputMode="numeric" placeholder="$3,000" value={low} onChange={(e) => setLow(e.target.value.replace(/[^0-9]/g, ""))} className={`${input} max-w-[160px]`} />
          <span className="text-ink-3">to</span>
          <input aria-label="Highest monthly price" inputMode="numeric" placeholder="$4,800" value={high} onChange={(e) => setHigh(e.target.value.replace(/[^0-9]/g, ""))} className={`${input} max-w-[160px]`} />
        </div>
      </fieldset>

      <fieldset className={card}>
        <legend className={legend}>Do you accept Medicaid?</legend>
        <Radio name="medicaid" value="yes" label="Yes" checked={medicaid === "yes"} onChange={setMedicaid} />
        <Radio name="medicaid" value="no" label="No" checked={medicaid === "no"} onChange={setMedicaid} />
        {medicaid === "yes" && (
          <input aria-label="Which Medicaid program" placeholder="Which program, for example ALTCS" value={program} onChange={(e) => setProgram(e.target.value)} maxLength={60} className={`${input} mt-3 max-w-[360px]`} />
        )}
      </fieldset>

      <fieldset className={card}>
        <legend className={legend}>How many staff are awake and on site overnight?</legend>
        <p className={hint}>Caregivers who are awake and working, not on call, and how many residents they look after.</p>
        <div className="flex flex-wrap items-center gap-3 text-[15px] text-ink-2">
          <input aria-label="Staff awake overnight" inputMode="numeric" placeholder="2" value={staff} onChange={(e) => setStaff(e.target.value.replace(/[^0-9]/g, ""))} className={`${input} max-w-[90px]`} />
          <span>staff awake for</span>
          <input aria-label="Residents overnight" inputMode="numeric" placeholder="12" value={residents} onChange={(e) => setResidents(e.target.value.replace(/[^0-9]/g, ""))} className={`${input} max-w-[90px]`} />
          <span>residents</span>
        </div>
      </fieldset>

      <fieldset className={card}>
        <legend className={legend}>What would lead you to ask a resident to move out?</legend>
        <p className={hint}>We may ask a resident to move out if they:</p>
        {MOVE_OUT_REASONS.map((r) => (
          <label key={r.value} className="flex cursor-pointer items-start gap-2.5 py-1 text-[15px] text-ink-2">
            <input type="checkbox" checked={reasons.includes(r.value)} onChange={() => toggleReason(r.value)} className="mt-1 h-4 w-4 accent-[var(--color-teal)]" />
            {r.label}
          </label>
        ))}
        <textarea aria-label="Anything else about when you would ask a resident to move" placeholder="Anything else families should know (optional, 400 characters)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} rows={3} className={`${input} mt-3`} />
      </fieldset>

      <fieldset className={card}>
        <legend className={legend}>Who is answering?</legend>
        <p className={hint}>
          Use an address at the home&rsquo;s own website domain if you have one, so we can check the answers came from you.
          We do not publish your email or name.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input aria-label="Your name" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={input} />
          <input type="email" required aria-label="Work email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} className={input} />
        </div>
      </fieldset>

      <fieldset className={card}>
        <legend className={legend}>Permission</legend>
        <label className="flex cursor-pointer items-start gap-2.5 py-1 text-[15px] text-ink-2">
          <input type="checkbox" required checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-teal)]" />
          {AUTHORIZED_TEXT}
        </label>
        <label className="mt-2 flex cursor-pointer items-start gap-2.5 py-1 text-[15px] text-ink-2">
          <input type="checkbox" checked={photoPermission} onChange={(e) => setPhotoPermission(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-teal)]" />
          {PHOTO_PERMISSION_TEXT}
        </label>
        <input type="url" aria-label="Link to photos" placeholder="Link to a photo gallery or folder (optional)" value={photoLink} onChange={(e) => setPhotoLink(e.target.value)} maxLength={500} className={`${input} mt-3`} />
        <p className="mb-0 mt-3 text-[12px] leading-relaxed text-ink-3">
          Photos are optional and are never required to answer. See our{" "}
          <Link href="/terms" className="text-teal underline underline-offset-4">Terms of Use</Link>.
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="m-0 rounded-[10px] border border-rust/30 bg-clearing-card px-4 py-3 text-[14px] text-rust">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !email.trim() || !authorized}
        className="rounded-full bg-teal px-6 py-3 font-[family-name:var(--font-sans)] text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send our answers"}
      </button>
    </form>
  );
}
