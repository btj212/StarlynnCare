"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ShortlistItem = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  state_slug: string;
  city: string | null;
  beds: number | null;
  total_citations: number;
  serious_citations: number;
  inspections: number;
  care_category: string;
};

type ShortlistCtx = {
  items: ShortlistItem[];
  add: (item: ShortlistItem) => void;
  remove: (id: string) => void;
  toggle: (item: ShortlistItem) => void;
  has: (id: string) => boolean;
  clear: () => void;
};

const Ctx = createContext<ShortlistCtx | null>(null);

const STORAGE_KEY = "sc_shortlist_v1";
const MAX = 10;

function emitClarityEvent(name: string) {
  try {
    const c = (window as unknown as { clarity?: (cmd: string, event: string) => void }).clarity;
    if (typeof c === "function") c("event", name);
  } catch {}
}

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ShortlistItem[]>([]);

  // Hydrate from localStorage once (client-only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as ShortlistItem[]);
    } catch {}
  }, []);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = useCallback((item: ShortlistItem) => {
    setItems((prev) => {
      if (prev.length >= MAX || prev.some((x) => x.id === item.id)) return prev;
      emitClarityEvent("shortlist_add");
      return [...prev, item];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const toggle = useCallback(
    (item: ShortlistItem) => {
      setItems((prev) => {
        if (prev.some((x) => x.id === item.id)) return prev.filter((x) => x.id !== item.id);
        if (prev.length >= MAX) return prev;
        emitClarityEvent("shortlist_add");
        return [...prev, item];
      });
    },
    [],
  );

  const has = useCallback((id: string) => items.some((x) => x.id === id), [items]);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, add, remove, toggle, has, clear }),
    [items, add, remove, toggle, has, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShortlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShortlist must be inside ShortlistProvider");
  return ctx;
}
