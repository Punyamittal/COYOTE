"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventFilters } from "@/types";

interface FilterState {
  filters: EventFilters;
  setFilters: (patch: Partial<EventFilters>) => void;
  resetFilters: () => void;
}

const defaults: EventFilters = {
  page: 1,
  pageSize: 50,
  sortBy: "date",
  sortDir: "asc",
};

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      filters: defaults,
      setFilters: (patch) =>
        set((s) => ({ filters: { ...s.filters, ...patch } })),
      resetFilters: () => set({ filters: defaults }),
    }),
    { name: "schedule-filters" }
  )
);

/** Wait until saved filters are restored so the first query is the real one. */
export function useHydratedFilters() {
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const [hydrated, setHydrated] = useState(() => useFilterStore.persist.hasHydrated());

  useEffect(() => {
    if (useFilterStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useFilterStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return { filters, setFilters, resetFilters, hydrated };
}
