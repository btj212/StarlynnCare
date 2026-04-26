declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function emitZipSearchSubmit(extra?: Record<string, string | number | undefined>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "zip_search_submit", extra ?? {});
}

export function emitFacilityCardOpen(extra?: Record<string, string | number | undefined>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "facility_card_open", extra ?? {});
}
