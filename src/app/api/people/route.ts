import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, getPersonById, insertPerson, logAudit, fireWebhooks, mapPersonRow, PERSON_SUMMARY_SELECT } from "@/lib/server";
import type { PersonInput } from "@/lib/types";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const rows = db.prepare(`${PERSON_SUMMARY_SELECT} ORDER BY p.updated_at DESC`).all() as Record<string, unknown>[];
  return json({ people: rows.map(mapPersonRow) });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const body = await req.json().catch(() => null);
  if (!body) return apiError("Geçersiz istek.");

  // toplu oluşturma (yapıştırma taşmaları için)
  if (Array.isArray(body.people)) {
    const created: string[] = [];
    for (const input of body.people as PersonInput[]) {
      const id = insertPerson(db, { ...input, source: input.source ?? "Yapıştırma" });
      created.push(id);
      logAudit(db, user, "person", id, "create", "Yapıştırma ile eklendi");
    }
    const people = created.map((id) => getPersonById(db, id));
    await fireWebhooks(db, "people.imported", { source: "paste", count: created.length, ids: created });
    return json({ people }, 201);
  }

  const input = body as PersonInput;
  if (!input.firstName?.trim() && !input.lastName?.trim() && !input.email?.trim()) {
    return apiError("En az ad, soyad veya e-posta gerekli.");
  }
  const id = insertPerson(db, input);
  logAudit(db, user, "person", id, "create", `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim());
  const person = getPersonById(db, id);
  await fireWebhooks(db, "person.created", person);
  return json(person, 201);
}
