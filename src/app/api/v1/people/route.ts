import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { apiError, json, checkApiKey, insertPerson, getPersonById, logAudit, fireWebhooks } from "@/lib/server";
import type { PersonInput } from "@/lib/types";

/**
 * Gelen entegrasyon API'si:
 *   GET  /api/v1/people          (ilk 100 kişi)
 *   POST /api/v1/people          tek kişi veya { people: [...] }
 * Yetkilendirme: Authorization: Bearer <api_key>
 */
export async function GET(req: NextRequest) {
  const db = getDb();
  if (!checkApiKey(db, req)) return apiError("Geçersiz API anahtarı.", 401);
  const rows = db.prepare("SELECT id, first_name, last_name, email, phone, company, city, created_at FROM people ORDER BY updated_at DESC LIMIT 100").all();
  return json({ people: rows });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!checkApiKey(db, req)) return apiError("Geçersiz API anahtarı.", 401);

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Geçersiz JSON gövdesi.");

  const inputs: Record<string, unknown>[] = Array.isArray(body.people) ? body.people : [body];
  const aliasMap: Record<string, string> = {
    firstname: "firstName", first_name: "firstName", ad: "firstName", isim: "firstName",
    lastname: "lastName", last_name: "lastName", soyad: "lastName",
    eposta: "email", "e-posta": "email", mail: "email",
    telefon: "phone", gsm: "phone",
    sirket: "company", firma: "company",
    sehir: "city", ünvan: "title", unvan: "title",
  };

  const created: string[] = [];
  for (const raw of inputs) {
    const input: PersonInput = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const key = aliasMap[k.toLowerCase()] ?? k;
      if (["firstName", "lastName", "email", "phone", "company", "title", "city", "notes", "source"].includes(key)) {
        (input as Record<string, unknown>)[key] = v == null ? "" : String(v);
      } else if (key === "tags") {
        input.tags = Array.isArray(v) ? v.map(String) : v == null ? "" : String(v);
      }
    }
    if (!input.firstName?.trim() && !input.lastName?.trim() && !input.email?.trim()) continue;
    created.push(insertPerson(db, input));
  }

  if (created.length === 0) return apiError("Eklenecek geçerli kişi bulunamadı (ad, soyad veya e-posta gerekli).");
  logAudit(db, null, "person", created[0], "create", `API ile ${created.length} kişi eklendi`);
  await fireWebhooks(db, "people.imported", { source: "api", count: created.length, ids: created });
  return json({ created: created.length, ids: created, people: created.map((id) => getPersonById(db, id)) }, 201);
}

export const runtime = "nodejs";
