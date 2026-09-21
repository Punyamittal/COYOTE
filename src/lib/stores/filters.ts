"use client";

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
