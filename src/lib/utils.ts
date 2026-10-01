import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const dateShortFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return dateFmt.format(d);
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return dateShortFmt.format(d);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${dateFmt.format(d)} ${timeFmt.format(d)}`;
}

export function daysAgo(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86400000);
}

export function formatRelative(iso?: string | null): string {
  const days = daysAgo(iso);
  if (days === null) return "—";
  if (days < 0) return `${formatDate(iso)} (gelecek)`;
  if (days === 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  const years = Math.floor(days / 365);
  return `${years} yıl önce`;
}

/** +905321234567 -> +90 532 123 45 67 (görüntüleme) */
export function formatPhone(raw?: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("90")) {
    const d = digits.slice(2);
    return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
  }
  if (digits.length === 10) {
    return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
  }
  return raw;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-violet-600", "bg-sky-600", "bg-emerald-600", "bg-rose-600",
  "bg-amber-600", "bg-indigo-600", "bg-teal-600", "bg-fuchsia-600",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function personName(p: { firstName: string; lastName: string }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "(isimsiz)";
}

export function parseTags(v?: string | string[] | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((t) => t.trim()).filter(Boolean);
  return v.split(",").map((t) => t.trim()).filter(Boolean);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/** TR telefonunu +90… standart biçimine çevirir. */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0090")) d = d.slice(4);
  else if (d.startsWith("90") && d.length > 10) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1); // 0532… → 532…
  if (d.length === 10) d = "90" + d;
  return d ? "+" + d : "";
}

export function genId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
