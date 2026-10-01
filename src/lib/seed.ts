import bcrypt from "bcryptjs";
import type Database from "better-sqlite3";
import { nowIso } from "./utils";

// Deterministik RNG — demo verisi her kurulumda aynı üretilir
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Ahmet", "Ayşe", "Mehmet", "Fatma", "Mustafa", "Zeynep", "Emre", "Elif", "Burak", "Merve",
  "Can", "Selin", "Emir", "Deniz", "Kerem", "Ece", "Arda", "Ceren", "Baran", "İrem",
  "Onur", "Melis", "Kaan", "Aslı", "Tolga", "Gizem", "Serkan", "Buse", "Umut", "Pınar",
  "Volkan", "Esra", "Cem", "Nil", "Alper", "Cansu", "Murat", "Duygu", "Efe", "Nazlı",
  "Hakan", "Şeyma", "Ozan", "Tuğçe", "Berk", "Damla", "Sinan", "Hilal", "Yiğit", "Beyza",
  "Ali", "Hazar", "Sude", "Kuzey", "Nehir", "Mert", "Derin", "Ege", "Yağmur", "Rüzgar",
];

const LAST_NAMES = [
  "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
  "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
  "Polat", "Erdoğan", "Korkmaz", "Bulut", "Güler", "Aksoy", "Turhan", "Barış", "Turan", "Ateş",
  "Çakır", "Toprak", "Avcı", "Sarı", "Duran", "Erdem", "Baş", "Kavak", "Uçar", "Tekin",
  "Acuner", "Sezer", "Balcı", "Işık", "Aktaş", "Yalçın", "Özer", "Ünal", "Keskin", "Alkan",
];

const COMPANIES = [
  "Anadolu Lojistik", "Marmara Turizm", "Bosphorus Tech", "Kule Medya", "Ege Gıda A.Ş.",
  "Nova Danışmanlık", "Atlas İnşaat", "Pera Reklam", "Vega Yazılım", "Toros Enerji",
  "Kervan Tekstil", "Delta Sağlık Grubu", "Mavi Koi Balıkçılık", "Zirve Eğitim", "Bereket Tarım",
  "Smyra Mimarlık", "Karıncayazılım", "Halat Denizcilik", "Lidya Madencilik", "Fön Müzik Prodüksiyon",
  "Kuzey Kırtasiye", "Oniks Kozmetik", "Pilot Havacılık", "Simba Oyuncak", "Titan Çelik",
  "Umman Balıkçılık", "Vanta Güvenlik", "Yosun Deniz Ürünleri", "Zamane Kitap", "Kıta Nakliye",
];

const TITLES = [
  "Satın Alma Müdürü", "İK Uzmanı", "Genel Müdür", "Pazarlama Direktörü", "Etkinlik Sorumlusu",
  "Kurucu Ortak", "Operasyon Müdürü", "Finans Müdürü", "Satış Yöneticisi", "İletişim Uzmanı",
  "Ofis Yöneticisi", "Proje Koordinatörü", "",
];

const CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep",
  "Eskişehir", "Trabzon", "Denizli", "Muğla", "Kayseri", "Samsun", "Balıkesir",
];

const TAG_POOL = ["VIP", "Kurumsal", "Bireysel", "Sponsor", "Basın", "Erken Kayıt"];

const SOURCES = ["Google Sheets", "Excel", "HubSpot", "Zoho", "Etkinlik formu", "Referans", "Web sitesi"];

const EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com"];

const COMPANY_DOMAINS = ["anadolulojistik.com.tr", "marmaraturizm.com", "bosphorustech.io", "kulemedya.com", "egegida.com.tr", "novadanismanlik.com"];

const CONVO_TOPICS = [
  { subject: "Fiyat teklifi gönderildi", note: "Paket fiyatları e-posta ile iletildi. 3 iş günü içinde dönüş bekleniyor." },
  { subject: "Katılım onayı alındı", note: "Etkinliğe katılımı telefon üzerinden onayladı." },
  { subject: "Paket detayları anlatıldı", note: "Standart ve VIP paket farklarını anlattım. VIP pakete ilgi gösterdi." },
  { subject: "Fatura ve ödeme bilgileri", note: "Kurumsal fatura bilgileri alındı, muhasebeye iletildi." },
  { subject: "Sponsorluk görüşmesi", note: "Sahne sponsorluğu için görüşme yapıldı. Teklif dosyası istedi." },
  { subject: "Etkinlik programı paylaşıldı", note: "Güncel program PDF'i gönderildi." },
  { subject: "Transfer ve konaklama detayları", note: "Otel seçenekleri ve havaalanı transferi hakkında bilgi verildi." },
  { subject: "Grup indirimi talebi", note: "10 kişilik grup için indirim talep etti. Yönetici onayı gerekiyor." },
  { subject: "Etkinlik sonrası teşekkür", note: "Katılımı için teşekkür edildi; memnuniyet anketi iletildi." },
  { subject: "Yeni etkinlik duyurusu", note: "Yaklaşan etkinlik hakkında bilgilendirildi, detay istedi." },
  { subject: "Basın akreditasyonu", note: "Basın kartı ve akreditasyon formu talep edildi." },
];

const EVENTS: Array<{ name: string; date: string; location: string; description: string; status: string; capacity: number }> = [
  { name: "İstanbul Teknoloji Zirvesi 2026", date: "2026-11-12", location: "İstanbul Kongre Merkezi", description: "Yıllık teknoloji ve inovasyon zirvesi.", status: "planned", capacity: 800 },
  { name: "Anadolu Startup Haftası", date: "2026-10-05", location: "Eskişehir Tepebaşı Kültür Merkezi", description: "Girişimcilik ekosistemi buluşması.", status: "planned", capacity: 350 },
  { name: "Mavi Tura Networking", date: "2026-08-22", location: "Bodrum Marina", description: "Deniz üzerinde gün batımı networking turu.", status: "completed", capacity: 120 },
  { name: "Kış Kardiyoloji Sempozyumu", date: "2026-12-03", location: "Uludağ Kongre Oteli", description: "Branş bazlı tıbbi sempozyum.", status: "planned", capacity: 250 },
  { name: "Gıda ve Tarım Fuarı", date: "2026-09-10", location: "İzmir Fuar Alanı", description: "Sektönel fuar ve B2B buluşmaları.", status: "ongoing", capacity: 1500 },
  { name: "Sahne Sanatları Festivali", date: "2026-07-18", location: "Aspendos Antik Tiyatro", description: "Açık hava tiyatro ve müzik festivali.", status: "completed", capacity: 2000 },
  { name: "Ege Yeşil Enerji Forumu", date: "2026-06-14", location: "Çeşme Alaçatı Kongre Merkezi", description: "Yenilenebilir enerji yatırımları forumu.", status: "completed", capacity: 400 },
  { name: "Kariyer Günleri 2026", date: "2026-05-08", location: "Ankara ATO Kongre Sarayı", description: "Üniversite öğrencileri ve yeni mezunlar için kariyer fuarı.", status: "completed", capacity: 1000 },
  { name: "Uluslararası Lojistik Kongresi", date: "2025-11-20", location: "Mersin Ticaret Odası", description: "Lojistik ve tedarik zinciri kongresi.", status: "completed", capacity: 500 },
  { name: "Bahçe Şehri Gastro Fest", date: "2025-09-27", location: "Antalya Kaleiçi", description: "Yerel lezzetler ve şef atölyeleri.", status: "completed", capacity: 900 },
];

const DEMO_PASSWORD = "pronto123";
export const DEMO_API_KEY = "pronto_sk_demo_2026_abcdef";

export function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
  if (count > 0) return;
  seed(db);
}

export function seed(db: Database.Database) {
  const rnd = mulberry32(20260930);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const intBetween = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

  const now = nowIso();
  const insertUser = db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role, active, created_at) VALUES (?,?,?,?,?,1,?)"
  );
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const users = [
    { id: crypto.randomUUID(), name: "Ayşe Yılmaz", email: "ayse@pronto.app", role: "admin" },
    { id: crypto.randomUUID(), name: "Can Demir", email: "can@pronto.app", role: "member" },
    { id: crypto.randomUUID(), name: "Elif Kaya", email: "elif@pronto.app", role: "member" },
  ];
  for (const u of users) insertUser.run(u.id, u.name, u.email, hash, u.role, "2025-01-15T09:00:00.000Z");
  const userIds = users.map((u) => u.id);

  const insertEvent = db.prepare(
    "INSERT INTO events (id, name, date, location, description, status, capacity, created_at) VALUES (?,?,?,?,?,?,?,?)"
  );
  const eventIds: string[] = [];
  for (const e of EVENTS) {
    const id = crypto.randomUUID();
    eventIds.push(id);
    insertEvent.run(id, e.name, e.date, e.location, e.description, e.status, e.capacity, "2025-01-20T09:00:00.000Z");
  }

  const insertPerson = db.prepare(
    `INSERT INTO people (id, first_name, last_name, email, phone, company, title, city, tags, notes, source, owner_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insertParticipant = db.prepare(
    "INSERT OR IGNORE INTO event_participants (event_id, person_id, status, registered_at) VALUES (?,?,?,?)"
  );
  const insertConversation = db.prepare(
    "INSERT INTO conversations (id, person_id, user_id, date, subject, note, created_at) VALUES (?,?,?,?,?,?,?)"
  );

  const usedEmails = new Set<string>();
  const NOW = new Date();

  for (let i = 0; i < 200; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const company = rnd() < 0.72 ? pick(COMPANIES) : "";
    const domain = company ? pick(COMPANY_DOMAINS) : pick(EMAIL_DOMAINS);
    let email = `${slug(firstName)}.${slug(lastName)}@${domain}`;
    if (usedEmails.has(email)) email = `${slug(firstName)}.${slug(lastName)}${i}@${domain}`;
    usedEmails.add(email);
    const phone = `+9053${intBetween(0, 9)}${String(intBetween(1000000, 9999999))}`;
    const tagCount = rnd() < 0.55 ? intBetween(1, 2) : 0;
    const tags = new Set<string>();
    for (let t = 0; t < tagCount; t++) tags.add(pick(TAG_POOL));
    // oluşturma: son 18 ay içinde
    const createdDaysAgo = intBetween(5, 540);
    const createdAt = new Date(NOW.getTime() - createdDaysAgo * 86400000).toISOString();
    const id = crypto.randomUUID();
    insertPerson.run(
      id, firstName, lastName, email, phone, company, pick(TITLES), pick(CITIES),
      Array.from(tags).join(", "), "", pick(SOURCES), pick(userIds), createdAt, createdAt
    );

    // etkinlik katılımları: 1-3 etkinlik
    const eventCount = rnd() < 0.5 ? 1 : rnd() < 0.85 ? 2 : 3;
    const chosenEvents = new Set<string>();
    for (let e = 0; e < eventCount; e++) {
      const idx = intBetween(0, EVENTS.length - 1);
      if (chosenEvents.has(String(idx))) continue;
      chosenEvents.add(String(idx));
      const ev = EVENTS[idx];
      const evDate = new Date(ev.date);
      const isPast = evDate < NOW;
      let status: string;
      if (isPast) {
        const r = rnd();
        status = r < 0.68 ? "attended" : r < 0.78 ? "cancelled" : "registered";
      } else {
        status = rnd() < 0.12 ? "waitlist" : "registered";
      }
      const regAt = new Date(Math.max(evDate.getTime() - intBetween(10, 90) * 86400000, new Date(createdAt).getTime()));
      insertParticipant.run(eventIds[idx], id, status, regAt.toISOString());
    }

    // görüşmeler: %35 hiç görüşme yok; kalanlarda 1-4 görüşme
    if (rnd() > 0.35) {
      const convoCount = intBetween(1, 4);
      for (let c = 0; c < convoCount; c++) {
        // görüşme, kişi eklendikten sonra ve bugünden önce
        const maxDays = Math.max(createdDaysAgo - 1, 1);
        const daysAgoVal = intBetween(0, maxDays);
        const date = new Date(NOW.getTime() - daysAgoVal * 86400000);
        date.setHours(intBetween(9, 18), intBetween(0, 59), 0, 0);
        const topic = pick(CONVO_TOPICS);
        insertConversation.run(
          crypto.randomUUID(), id, pick(userIds), date.toISOString(), topic.subject, topic.note, date.toISOString()
        );
      }
    }
  }

  // Demo API anahtarı (gelen entegrasyonlar için)
  db.prepare("INSERT INTO api_keys (id, name, key_hash, prefix, active, created_at) VALUES (?,?,?,?,1,?)").run(
    crypto.randomUUID(),
    "Demo anahtarı",
    sha256Sync(DEMO_API_KEY),
    DEMO_API_KEY.slice(0, 18),
    now
  );

  // Devre dışı örnek webhook
  db.prepare("INSERT INTO webhooks (id, name, url, secret, events, active, created_at) VALUES (?,?,?,?,?,0,?)").run(
    crypto.randomUUID(),
    "Örnek webhook",
    "https://example.com/hooks/pronto",
    crypto.randomUUID().replace(/-/g, ""),
    JSON.stringify(["person.created", "conversation.created"]),
    now
  );

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('orgName', ?)").run("Pronto Etkinlik");
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('autoBackup', 'off')").run();

  seedLookups(db);
}

// ---------- lookup değerleri ----------

/** Türkiye'nin 81 ili */
export const TR_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya",
  "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik",
  "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum",
  "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir",
  "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
  "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale",
  "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa",
  "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye",
  "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Şanlıurfa", "Şırnak",
  "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat",
  "Zonguldak",
];

export const LOOKUP_TYPES = ["title", "city", "source"] as const;
export type LookupType = (typeof LOOKUP_TYPES)[number];

/** Şehirler için 81 il; diğer tipler için kişilerde geçen mevcut değerler. */
export function seedLookups(db: Database.Database) {
  const ins = db.prepare(
    "INSERT OR IGNORE INTO lookup_values (id, type, value, created_at) VALUES (?,?,?,?)"
  );
  const now = nowIso();

  for (const city of TR_CITIES) {
    ins.run(crypto.randomUUID(), "city", city, now);
  }

  const titles = db.prepare("SELECT DISTINCT title AS v FROM people WHERE title != ''").all() as Array<{ v: string }>;
  for (const t of titles) ins.run(crypto.randomUUID(), "title", t.v, now);

  const sources = db.prepare("SELECT DISTINCT source AS v FROM people WHERE source != ''").all() as Array<{ v: string }>;
  for (const s of sources) ins.run(crypto.randomUUID(), "source", s.v, now);
}

export function seedLookupsIfEmpty(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) AS c FROM lookup_values").get() as { c: number }).c;
  if (count === 0) seedLookups(db);
}

function slug(s: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i" };
  return s
    .toLowerCase()
    .replace(/[çğıöşüİ]/g, (m) => map[m] ?? m)
    .replace(/[^a-z0-9]/g, "");
}

function sha256Sync(input: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(input).digest("hex");
}
