"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { HomeSampleFacility } from "@/components/home/homeSampleFacilityTypes";
import { HomeSampleFacilityCard } from "@/components/home/HomeSampleFacilityCard";
import { MobileFacilityGradeCard } from "@/components/mobile/MobileFacilityGradeCard";

const RotationContext = createContext<{
  facility: HomeSampleFacility | null;
  index: number;
  total: number;
  advance: () => void;
} | null>(null);

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

const ROTATE_MS = 8000;

export function SampleFacilityRotationProvider({
  facilities,
  children,
}: {
  facilities: HomeSampleFacility[];
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const len = facilities.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (len <= 1) return;
    if (reducedMotion) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % len),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [len, reducedMotion]);

  const facility = len > 0 ? facilities[index % len]! : null;

  const advance = useCallback(() => {
    if (len <= 1) return;
    setIndex((i) => (i + 1) % len);
  }, [len]);

  const value = useMemo(
    () => ({
      facility,
      index: len ? index % len : 0,
      total: len,
      advance,
    }),
    [facility, index, len, advance],
  );

  return (
    <RotationContext.Provider value={value}>{children}</RotationContext.Provider>
  );
}

function useSampleRotation() {
  const ctx = useContext(RotationContext);
  if (!ctx) {
    throw new Error("Sample facility rotation components must be inside SampleFacilityRotationProvider");
  }
  return ctx;
}

/** Desktop §02 sample card — synced rotation with mobile */
export function SyncedHomeSampleCardDesktop({ className }: { className?: string }) {
  const { facility, index, total } = useSampleRotation();
  const prefersReduced = useReducedMotion();

  if (!facility) {
    return (
      <div
        className={
          className ??
          "border border-paper-rule p-10 flex items-center justify-center text-ink-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em]"
        }
        style={{ background: "var(--color-paper-2)", minHeight: 260 }}
      >
        Facility data card
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        aria-live="polite"
        aria-atomic="true"
        key={facility.id}
        className={prefersReduced ? "" : "motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out"}
      >
        <HomeSampleFacilityCard facility={facility} />
      </div>
      {total > 1 && (
        <div
          className="mt-3 flex justify-center gap-1.5"
          aria-hidden
        >
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="h-1 rounded-full transition-[width,opacity] duration-300"
              style={{
                width: i === index ? 18 : 6,
                opacity: i === index ? 1 : 0.35,
                background: "var(--color-teal)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Mobile §02 sample card — same rotation index as desktop */
export function SyncedHomeSampleCardMobile({ className }: { className?: string }) {
  const { facility, index, total } = useSampleRotation();
  const prefersReduced = useReducedMotion();

  if (!facility) {
    return (
      <div className={className ?? "mx-[18px] border border-paper-rule bg-paper-2 p-8 text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-4"}>
        Sample facility card loading…
      </div>
    );
  }

  return (
    <div className={className ?? "px-0"}>
      <div
        aria-live="polite"
        aria-atomic="true"
        key={facility.id}
        className={prefersReduced ? "" : "motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out"}
      >
        <MobileFacilityGradeCard facility={facility} />
      </div>
      {total > 1 && (
        <div className="mt-3 flex justify-center gap-1.5 px-[18px]" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="h-1 rounded-full transition-[width,opacity] duration-300"
              style={{
                width: i === index ? 18 : 6,
                opacity: i === index ? 1 : 0.35,
                background: "var(--color-teal)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
