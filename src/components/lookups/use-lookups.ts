"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/client-api";

export interface LookupItem {
  id: string;
  value: string;
  usage: number;
}

export interface LookupLists {
  title: LookupItem[];
  city: LookupItem[];
  source: LookupItem[];
}

export type LookupType = keyof LookupLists;

export const EMPTY_LOOKUPS: LookupLists = { title: [], city: [], source: [] };

export function useLookups() {
  const { data } = useQuery({
    queryKey: ["lookups"],
    queryFn: () => apiGet<LookupLists>("/api/lookups"),
    staleTime: 5 * 60 * 1000,
  });
  return data ?? EMPTY_LOOKUPS;
}
