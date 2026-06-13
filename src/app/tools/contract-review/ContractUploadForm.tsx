"use client";

import { useState, useRef } from "react";

type State = "idle" | "uploading" | "done" | "error";

export function ContractUploadForm() {
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !file) return;

    setState("uploading");
    setErrorMsg("");

    const form = new FormData();
    form.append("email", email.trim());
    form.append("file", file);

    try {
      const res = await fetch("/api/tools/contract-review", {
        method: "POST",
        body: form,
      });

      const json = await res.json().catch(() => ({})) as { error?: string };

      if (res.ok) {
        setState("done");
      } else {
        setErrorMsg(json.error ?? "Something went wrong — please try again.");
        setState("error");
      }
    } catch {
      setErrorMsg("Network error — please try again.");
      setState("error");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    setFile(chosen);
    if (state === "error") setState("idle");
  }

  if (state === "done") {
    return (
      <div className="rounded border border-paper-rule bg-paper-2 px-6 py-8 text-center">
        <p className="font-[family-name:var(--font-display)] text-[28px] text-ink mb-3">✓ Document received</p>
        <p className="text-[15.5px] text-ink-3 leading-relaxed max-w-[48ch] mx-auto">
          We&rsquo;ll review your agreement and email a plain-language breakdown to{" "}
          <strong className="text-ink">{email}</strong> within 3–5 business days.
        </p>
        <p className="mt-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
          Education, not legal advice · all documents handled confidentially
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cdr-email"
          className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-3"
        >
          Your email address <span className="text-rust">*</span>
        </label>
        <input
          id="cdr-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={state === "uploading"}
          className="h-11 border border-paper-rule bg-paper px-3 font-[family-name:var(--font-mono)] text-[13px] text-ink placeholder:text-ink-4 focus:outline-none focus:border-teal disabled:opacity-50 w-full max-w-sm"
        />
      </div>

      {/* File upload */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cdr-file"
          className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-3"
        >
          Admission agreement <span className="text-rust">*</span>
        </label>
        <div
          className="border-2 border-dashed border-paper-rule rounded px-6 py-8 text-center cursor-pointer transition-colors hover:border-teal"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          tabIndex={0}
          role="button"
          aria-label="Choose file to upload"
        >
          {file ? (
            <div>
              <p className="font-[family-name:var(--font-mono)] text-[12px] text-teal">{file.name}</p>
              <p className="text-[12px] text-ink-4 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-[15px] text-ink-3 mb-1">Drop your PDF or Word document here</p>
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
                PDF · DOCX · JPG · PNG · max 10 MB
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          id="cdr-file"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          disabled={state === "uploading"}
          className="sr-only"
        />
      </div>

      {errorMsg && (
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-rust">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={state === "uploading" || !email.trim() || !file}
        className="h-11 px-7 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: "var(--color-teal)" }}
      >
        {state === "uploading" ? "Uploading…" : "Send for review →"}
      </button>

      <p className="font-[family-name:var(--font-mono)] text-[10.5px] text-ink-4 leading-relaxed">
        Education only — not legal advice. Your document is stored securely and not shared.
        We typically respond within 3–5 business days.
      </p>
    </form>
  );
}
