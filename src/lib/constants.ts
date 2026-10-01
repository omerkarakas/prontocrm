import type { FilterOp } from "./types";

export const APP_NAME = "Pronto CRM";

export const EVENT_STATUSES = [
  { value: "planned", label: "Planlandı" },
  { value: "ongoing", label: "Devam ediyor" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal" },
] as const;

export const PARTICIPANT_STATUSES = [
  { value: "registered", label: "Kayıtlı" },
  { value: "attended", label: "Katıldı" },
  { value: "waitlist", label: "Yedek" },
  { value: "cancelled", label: "İptal" },
] as const;

export const SOURCE_SUGGESTIONS = [
  "Google Sheets",
  "Excel",
  "HubSpot",
  "Zoho",
  "Etkinlik formu",
  "Referans",
  "Web sitesi",
];

export const TAG_SUGGESTIONS = ["VIP", "Kurumsal", "Bireysel", "Sponsor", "Basın", "Erken Kayıt"];

export const WEBHOOK_EVENTS = [
  { value: "person.created", label: "Kişi oluşturuldu" },
  { value: "person.updated", label: "Kişi güncellendi" },
  { value: "person.deleted", label: "Kişi silindi" },
  { value: "conversation.created", label: "Görüşme eklendi" },
  { value: "people.imported", label: "Toplu içe aktarma" },
] as const;

// ---------- filtre alanları ----------

export interface FilterField {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "number";
  options?: { value: string; label: string }[];
}

export const FILTER_FIELDS: FilterField[] = [
  { key: "firstName", label: "Ad", type: "text" },
  { key: "lastName", label: "Soyad", type: "text" },
  { key: "email", label: "E-posta", type: "text" },
  { key: "phone", label: "Telefon", type: "text" },
  { key: "company", label: "Şirket", type: "text" },
  { key: "title", label: "Ünvan", type: "text" },
  { key: "city", label: "Şehir", type: "text" },
  { key: "tags", label: "Etiketler", type: "text" },
  { key: "source", label: "Kaynak", type: "text" },
  { key: "notes", label: "Notlar", type: "text" },
  { key: "ownerName", label: "Sorumlu", type: "text" },
  { key: "eventNames", label: "Etkinlikler", type: "text" },
  { key: "lastConversationAt", label: "Son görüşme", type: "date" },
  { key: "lastConversationSubject", label: "Son görüşme konusu", type: "text" },
  { key: "conversationCount", label: "Görüşme sayısı", type: "number" },
  { key: "createdAt", label: "Eklenme tarihi", type: "date" },
];

export const FILTER_OPS: Record<string, { value: FilterOp; label: string }[]> = {
  text: [
    { value: "contains", label: "içerir" },
    { value: "notContains", label: "içermez" },
    { value: "equals", label: "eşittir" },
    { value: "isEmpty", label: "boş" },
    { value: "isNotEmpty", label: "dolu" },
  ],
  date: [
    { value: "lastDays", label: "son X gün içinde" },
    { value: "onOrAfter", label: "bu tarihten sonra" },
    { value: "onOrBefore", label: "bu tarihten önce" },
    { value: "isEmpty", label: "hiç yok" },
    { value: "isNotEmpty", label: "var" },
  ],
  number: [
    { value: "equals", label: "=" },
    { value: "lastDays", label: "≥" },
    { value: "onOrBefore", label: "≤" },
  ],
};

// ---------- içe aktarma hedef alanları ----------

export interface ImportTarget {
  key: string;
  label: string;
  required?: boolean;
  kind: "person" | "conversation";
  sample?: string;
}

export const IMPORT_TARGETS: ImportTarget[] = [
  { key: "firstName", label: "Ad", required: true, kind: "person" },
  { key: "lastName", label: "Soyad", required: true, kind: "person" },
  { key: "email", label: "E-posta", kind: "person" },
  { key: "phone", label: "Telefon", kind: "person" },
  { key: "company", label: "Şirket", kind: "person" },
  { key: "title", label: "Ünvan", kind: "person" },
  { key: "city", label: "Şehir", kind: "person" },
  { key: "tags", label: "Etiketler (virgülle)", kind: "person" },
  { key: "notes", label: "Notlar", kind: "person" },
  { key: "source", label: "Kaynak", kind: "person" },
  { key: "conversationDate", label: "Görüşme tarihi", kind: "conversation" },
  { key: "conversationSubject", label: "Görüşme konusu", kind: "conversation" },
  { key: "conversationNote", label: "Görüşme notu", kind: "conversation" },
];

/** Sütun başlığından hedef alan tahmini */
const GUESS_MAP: Record<string, string[]> = {
  firstName: ["ad", "isim", "adı", "first name", "firstname", "given name", "name"],
  lastName: ["soyad", "soyisim", "last name", "lastname", "surname", "family name"],
  email: ["e-posta", "eposta", "e posta", "email", "e-mail", "mail", "email address", "emailaddress"],
  phone: ["telefon", "tel", "gsm", "cep", "phone", "mobile", "phone number", "cell"],
  company: ["şirket", "firma", "company", "organization", "organisation", "account name", "kurum"],
  title: ["ünvan", "unvan", "title", "job title", "position", "görev"],
  city: ["şehir", "sehir", "il", "city", "mailing city", "location"],
  tags: ["etiket", "etiketler", "tag", "tags"],
  notes: ["not", "notlar", "note", "notes", "açıklama", "aciklama"],
  source: ["kaynak", "source", "lead source"],
  conversationDate: ["görüşme tarihi", "gorusme tarihi", "last activity", "son görüşme", "last contact"],
  conversationSubject: ["görüşme konusu", "konu", "subject", "last activity notes"],
  conversationNote: ["görüşme notu", "not", "notes", "activity note"],
};

export function guessTarget(header: string): string | null {
  const h = header.trim().toLowerCase().replace(/[_*]+/g, " ").replace(/\s+/g, " ");
  if (!h) return null;
  for (const [target, names] of Object.entries(GUESS_MAP)) {
    if (names.some((n) => h === n)) return target;
  }
  for (const [target, names] of Object.entries(GUESS_MAP)) {
    if (names.some((n) => h.includes(n))) return target;
  }
  return null;
}

export const QUICK_VIEWS = [
  { id: "all", label: "Tüm kişiler" },
  { id: "no-contact", label: "Hiç görüşülmeyenler" },
  { id: "stale", label: "90+ gündür görüşülmeyenler" },
  { id: "recent-added", label: "Son 30 günde eklenenler" },
  { id: "vip", label: "VIP etiketliler" },
] as const;
