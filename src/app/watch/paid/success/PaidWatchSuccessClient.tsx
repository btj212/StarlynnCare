"use client";

import { useEffect } from "react";
import { emitPaidWatchActivated } from "@/lib/analytics/clarityEvents";

/** Fires a Clarity activation event once on the success page. */
export function PaidWatchSuccessClient() {
  useEffect(() => {
    emitPaidWatchActivated();
  }, []);
  return null;
}
