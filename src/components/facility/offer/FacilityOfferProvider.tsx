"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Offer } from "@/lib/facility/offers";
import {
  setOfferVariant,
  emitOfferImpression,
  emitOfferClick,
  emitOfferConvert,
} from "@/lib/analytics/clarityEvents";
import { submitWatch } from "@/lib/watch/submitWatch";

/* ── Context ─────────────────────────────────────────────────── */

interface OfferCtx {
  offer: Offer;
  facilityId: string;
  facilityName: string;
  openModal: () => void;
  triggerOffer: () => void;
}

const Ctx = createContext<OfferCtx | null>(null);

export function useOffer(): OfferCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOffer must be used inside FacilityOfferProvider");
  return ctx;
}

/* ── Modal ───────────────────────────────────────────────────── */

type FormState = "idle" | "submitting" | "success" | "error";

function OfferModal({
  offer,
  facilityId,
  facilityName,
  onClose,
}: {
  offer: Offer;
  facilityId: string;
  facilityName: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setFormState("submitting");
    setErrorMsg("");

    const result = await submitWatch({
      email: email.trim(),
      facilityId,
      facilityName,
      source: `offer_${offer.id}`,
      intent: offer.journeyStage === "search" ? "research" : "touring",
    });

    if (result.ok) {
      emitOfferConvert(offer.id);
      setFormState("success");
    } else {
      setErrorMsg(result.error ?? "Something went wrong.");
      setFormState("error");
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-[420px] border-2 border-ink p-7"
        style={{ backgroundColor: "var(--color-paper)" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center font-[family-name:var(--font-mono)] text-[20px] leading-none text-ink-3 hover:text-ink transition-colors"
        >
          ×
        </button>

        {formState === "success" ? (
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-teal mb-3">
              ✓ On its way
            </div>
            <p className="font-[family-name:var(--font-display)] text-[20px] leading-[1.35] text-ink">
              Check your inbox in the next few minutes.
            </p>
            <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-3">
              No spam. Unsubscribe any time.
            </p>
          </div>
        ) : (
          <>
            {/* Eyebrow */}
            <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-rust mb-2">
              {offer.eyebrow}
            </div>

            {/* Headline */}
            <h2 className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.01em] text-ink mb-2">
              {offer.headline}
            </h2>
            <p className="font-[family-name:var(--font-mono)] text-[11.5px] tracking-[0.03em] text-ink-2 leading-relaxed mb-5">
              {offer.sub}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={formState === "submitting"}
                className="h-12 w-full border border-paper-rule bg-paper px-3 font-[family-name:var(--font-mono)] text-[13px] text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={formState === "submitting" || !email.trim()}
                className="h-12 w-full font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.14em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-teal)" }}
              >
                {formState === "submitting" ? "Sending…" : offer.ctaLabel}
              </button>
              {formState === "error" && (
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-rust">
                  {errorMsg}
                </p>
              )}
            </form>

            <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.04em] text-ink-4">
              Free · no spam · unsubscribe any time
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Provider ────────────────────────────────────────────────── */

export function FacilityOfferProvider({
  offer,
  facilityId,
  facilityName,
  children,
}: {
  offer: Offer;
  facilityId: string;
  facilityName: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  // Fire Clarity impression once on mount
  useEffect(() => {
    setOfferVariant(offer.id);
    emitOfferImpression(offer.id);
  }, [offer.id]);

  const openModal = useCallback(() => setModalOpen(true), []);

  const triggerOffer = useCallback(() => {
    emitOfferClick(offer.id);
    if (offer.kind === "route" && offer.href) {
      router.push(offer.href);
    } else {
      setModalOpen(true);
    }
  }, [offer, router]);

  return (
    <Ctx.Provider value={{ offer, facilityId, facilityName, openModal, triggerOffer }}>
      {children}
      {modalOpen && offer.kind !== "route" && (
        <OfferModal
          offer={offer}
          facilityId={facilityId}
          facilityName={facilityName}
          onClose={() => setModalOpen(false)}
        />
      )}
    </Ctx.Provider>
  );
}

/* ── Trigger Button ──────────────────────────────────────────── */

interface OfferTriggerButtonProps {
  /** "full" = full ctaLabel, "compact" = ctaLabelCompact */
  size?: "full" | "compact";
  className?: string;
}

export function OfferTriggerButton({
  size = "full",
  className,
}: OfferTriggerButtonProps) {
  const { offer, triggerOffer } = useOffer();
  const label = size === "compact" ? offer.ctaLabelCompact : offer.ctaLabel;

  return (
    <button
      type="button"
      onClick={triggerOffer}
      className={
        className ??
        "inline-flex items-center gap-1.5 bg-teal px-4 py-2.5 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.1em] text-paper hover:opacity-90 transition-opacity"
      }
    >
      {label}
    </button>
  );
}
