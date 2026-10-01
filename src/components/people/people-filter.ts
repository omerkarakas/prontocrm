import type { FilterRule, Person, SortState } from "@/lib/types";

export interface PeopleViewState {
  search: string;
  rules: FilterRule[];
  quickView: string;
  sort: SortState;
}

export const DEFAULT_VIEW_STATE: PeopleViewState = { search: "", rules: [], quickView: "all", sort: null };

function fieldText(p: Person, field: string): string {
  switch (field) {
    case "tags": return p.tags.join(", ").toLowerCase();
    case "eventNames": return (p.eventNames ?? "").replace(/\n/g, ", ").toLowerCase();
    case "ownerName": return (p.ownerName ?? "").toLowerCase();
    default: {
      const v = (p as unknown as Record<string, unknown>)[field];
      return v == null ? "" : String(v).toLowerCase();
    }
  }
}

function matchRule(p: Person, rule: FilterRule): boolean {
  if (rule.field === "conversationCount") {
    const n = p.conversationCount;
    const v = Number(rule.value ?? 0);
    if (rule.op === "equals") return n === v;
    if (rule.op === "lastDays") return n >= v; // "≥" için
    if (rule.op === "onOrBefore") return n <= v;
    return true;
  }
  if (rule.field === "lastConversationAt" || rule.field === "createdAt") {
    const iso = rule.field === "createdAt" ? p.createdAt : p.lastConversationAt;
    if (rule.op === "isEmpty") return !iso;
    if (rule.op === "isNotEmpty") return Boolean(iso);
    if (!iso) return false;
    if (rule.op === "lastDays") {
      const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
      return days <= Number(rule.value ?? 30);
    }
    if (rule.op === "onOrAfter") return iso.slice(0, 10) >= (rule.value ?? "");
    if (rule.op === "onOrBefore") return iso.slice(0, 10) <= (rule.value ?? "");
    return true;
  }
  const text = fieldText(p, rule.field);
  const value = (rule.value ?? "").toLowerCase().trim();
  switch (rule.op) {
    case "contains": return text.includes(value);
    case "notContains": return !text.includes(value);
    case "equals": return text === value;
    case "isEmpty": return text === "" || text === "—";
    case "isNotEmpty": return text !== "" && text !== "—";
    default: return true;
  }
}

function matchQuickView(p: Person, quickView: string): boolean {
  switch (quickView) {
    case "no-contact": return p.conversationCount === 0;
    case "stale": {
      if (!p.lastConversationAt) return false;
      const days = Math.round((Date.now() - new Date(p.lastConversationAt).getTime()) / 86400000);
      return days > 90;
    }
    case "recent-added": {
      const days = Math.round((Date.now() - new Date(p.createdAt).getTime()) / 86400000);
      return days <= 30;
    }
    case "vip": return p.tags.some((t) => t.toLowerCase() === "vip");
    default: return true;
  }
}

function getSortValue(p: Person, key: string): string | number | null {
  const v = (p as unknown as Record<string, unknown>)[key];
  if (key === "tags") return p.tags.join(", ");
  if (key === "eventNames") return (p.eventNames ?? "").replace(/\n/g, ", ");
  if (v == null) return null;
  if (typeof v === "number") return v;
  return String(v);
}

export function applyPeopleFilters(rows: Person[], state: PeopleViewState): Person[] {
  const q = state.search.trim().toLowerCase();
  let out = rows;

  if (q) {
    out = out.filter((p) =>
      [
        p.firstName, p.lastName, p.email, p.phone, p.company, p.title,
        p.city, p.tags.join(" "), p.notes, p.source, p.ownerName ?? "", (p.eventNames ?? "").replace(/\n/g, " "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  if (state.quickView !== "all") {
    out = out.filter((p) => matchQuickView(p, state.quickView));
  }

  if (state.rules.length) {
    out = out.filter((p) => state.rules.every((r) => matchRule(p, r)));
  }

  if (state.sort) {
    const { key, dir } = state.sort;
    const mul = dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = getSortValue(a, key);
      const bv = getSortValue(b, key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // boş değerler sona
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av).localeCompare(String(bv), "tr") * mul;
    });
  }

  return out;
}

// ---------- kayıtlı görünümler ----------

export interface SavedView {
  id: string;
  name: string;
  state: Pick<PeopleViewState, "rules" | "quickView" | "sort">;
}

const VIEWS_KEY = "pronto:saved-views";

export function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

export function saveSavedViews(views: SavedView[]) {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch {
    // yoksay
  }
}
