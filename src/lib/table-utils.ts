import type { SortState } from "./types";

/** Izgaralarda yeniden kullanılabilen istemci tarafı sıralama; boş değerleri sona atar. */
export function sortRowsBy<T>(
  rows: T[],
  sort: SortState,
  getValue: (row: T, key: string) => string | number | null | undefined
): T[] {
  if (!sort) return rows;
  const mul = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = getValue(a, sort.key);
    const bv = getValue(b, sort.key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
    return String(av).localeCompare(String(bv), "tr") * mul;
  });
}
