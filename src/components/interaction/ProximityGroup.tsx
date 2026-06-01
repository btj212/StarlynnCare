"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const ITEM_SELECTOR = "[data-proximity-item]";

type ProximityGroupProps = {
  children: ReactNode;
  className?: string;
  /** Pixels from item center where effect reaches zero. */
  radius?: number;
  /** Max scale added at cursor center (0.04 → 4% larger). */
  intensity?: number;
};

function resetItems(container: HTMLElement | null) {
  container?.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((el) => {
    el.style.transform = "";
    el.style.zIndex = "";
  });
}

/**
 * Proximity-based scale — neighbors lift subtly as the pointer approaches,
 * not just the element under the cursor. Disabled for reduced-motion and
 * coarse pointers.
 */
export function ProximityGroup({
  children,
  className,
  radius = 160,
  intensity = 0.04,
}: ProximityGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const canAnimateRef = useRef(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      canAnimateRef.current = finePointer.matches && !reducedMotion;
    };
    sync();
    finePointer.addEventListener("change", sync);
    return () => finePointer.removeEventListener("change", sync);
  }, [reducedMotion]);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!canAnimateRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      container.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        const t = Math.max(0, 1 - dist / radius);
        const scale = 1 + t * intensity;
        el.style.transform = `scale(${scale})`;
        el.style.zIndex = t > 0.05 ? "1" : "";
      });
    },
    [radius, intensity],
  );

  const onPointerLeave = useCallback(() => {
    resetItems(containerRef.current);
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}

/** Marks a direct child for proximity scaling inside ProximityGroup. */
export function proximityItemProps(className?: string) {
  return {
    "data-proximity-item": true,
    className: [
      className,
      "origin-center will-change-transform motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out",
    ]
      .filter(Boolean)
      .join(" "),
  } as const;
}
