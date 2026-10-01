import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
  requireApiUser, unauthorized, json, apiError, getPersonById, logAudit, fireWebhooks,
  computeChanges, normalizePersonInput,
} from "@/lib/server";
import { nowIso } from "@/lib/utils";
import type { PersonInput } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;

  const person = getPersonById(db, id);
  if (!person) return apiError("Kişi bulunamadı.", 404);

  const conversations = (
    db.prepare(
      `SELECT c.*, u.name AS user_name FROM conversations c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.person_id = ? ORDER BY c.date DESC`
    ).all(id) as Record<string, unknown>[]
  ).map((c) => ({
    id: c.id as string,
    personId: c.person_id as string,
    userId: (c.user_id as string | null) ?? null,
    userName: (c.user_name as string | null) ?? null,
    date: c.date as string,
    subject: (c.subject as string) ?? "",
    note: (c.note as string) ?? "",
    createdAt: c.created_at as string,
  }));

  const events = (
    db.prepare(
      `SELECT e.id, e.name, e.date, e.location, ep.status, ep.registered_at
       FROM event_participants ep JOIN events e ON e.id = ep.event_id
       WHERE ep.person_id = ? ORDER BY e.date DESC`
    ).all(id) as Record<string, unknown>[]
  ).map((e) => ({
    id: e.id as string,
    name: e.name as string,
    date: e.date as string,
    location: (e.location as string) ?? "",
    status: e.status as string,
    registeredAt: e.registered_at as string,
  }));

  const audit = (
    db.prepare(
      `SELECT * FROM audit_log WHERE (entity = 'person' AND entity_id = ?) OR (entity = 'conversation' AND entity_id IN
        (SELECT id FROM conversations WHERE person_id = ?))
       ORDER BY created_at DESC LIMIT 50`
    ).all(id, id) as Record<string, unknown>[]
  ).map((a) => ({
    id: a.id as string,
    userName: (a.user_name as string | null) ?? null,
    action: a.action as string,
    summary: (a.summary as string | null) ?? null,
    changes: a.changes ? JSON.parse(a.changes as string) : null,
    createdAt: a.created_at as string,
  }));

  return json({ person, conversations, events, audit });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PersonInput | null;
  if (!body) return apiError("Geçersiz istek.");

  const before = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!before) return apiError("Kişi bulunamadı.", 404);

  const n = normalizePersonInput(body);
  const sets: string[] = [];
  const sqlParams: Record<string, unknown> = { id, now: nowIso() };
  const colMap: Record<string, string> = {
    firstName: "first_name", lastName: "last_name", email: "email", phone: "phone", company: "company",
    title: "title", city: "city", tags: "tags", notes: "notes", source: "source",
  };
  for (const [field, value] of Object.entries(n)) {
    if (value === undefined) continue;
    const col = colMap[field] ?? field;
    if (field === "ownerId") {
      sets.push("owner_id = @ownerId");
      sqlParams.ownerId = value;
    } else {
      sets.push(`${col} = @${field}`);
      sqlParams[field] = value;
    }
  }
  if (sets.length === 0) return json(getPersonById(db, id));

  sets.push("updated_at = @now");
  db.prepare(`UPDATE people SET ${sets.join(", ")} WHERE id = @id`).run(sqlParams);

  const after = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as Record<string, unknown>;
  const changes = computeChanges(before, after);
  logAudit(db, user, "person", id, "update", undefined, changes);
  const person = getPersonById(db, id);
  await fireWebhooks(db, "person.updated", person);
  return json(person);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;

  const person = getPersonById(db, id);
  if (!person) return apiError("Kişi bulunamadı.", 404);

  db.prepare("DELETE FROM people WHERE id = ?").run(id);
  logAudit(db, user, "person", id, "delete", `${person.firstName} ${person.lastName}`);
  await fireWebhooks(db, "person.deleted", person);
  return json({ ok: true });
}

export const runtime = "nodejs";
