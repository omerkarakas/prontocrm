import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;

  const ev = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status != 'cancelled') AS participant_count,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'attended') AS attended_count
       FROM events e WHERE e.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!ev) return apiError("Etkinlik bulunamadı.", 404);

  const participants = (
    db.prepare(
      `SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.company, p.city,
        ep.status, ep.registered_at,
        (SELECT MAX(c.date) FROM conversations c WHERE c.person_id = p.id) AS last_conversation_at,
        (SELECT c.subject FROM conversations c WHERE c.person_id = p.id ORDER BY c.date DESC LIMIT 1) AS last_conversation_subject
       FROM event_participants ep JOIN people p ON p.id = ep.person_id
       WHERE ep.event_id = ?
       ORDER BY p.first_name`
    ).all(id) as Record<string, unknown>[]
  ).map((r) => ({
    personId: r.id as string,
    firstName: (r.first_name as string) ?? "",
    lastName: (r.last_name as string) ?? "",
    email: (r.email as string) ?? "",
    phone: (r.phone as string) ?? "",
    company: (r.company as string) ?? "",
    city: (r.city as string) ?? "",
    status: r.status as string,
    registeredAt: r.registered_at as string,
    lastConversationAt: (r.last_conversation_at as string | null) ?? null,
    lastConversationSubject: (r.last_conversation_subject as string | null) ?? null,
  }));

  return json({
    event: {
      id: ev.id as string,
      name: ev.name as string,
      date: ev.date as string,
      location: (ev.location as string) ?? "",
      description: (ev.description as string) ?? "",
      status: ev.status as string,
      capacity: (ev.capacity as number | null) ?? null,
      createdAt: ev.created_at as string,
      participantCount: (ev.participant_count as number) ?? 0,
      attendedCount: (ev.attended_count as number) ?? 0,
    },
    participants,
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError("Geçersiz istek.");

  const fields: string[] = [];
  const vals: Record<string, unknown> = { id };
  for (const key of ["name", "date", "location", "description", "status"] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = @${key}`);
      vals[key] = String(body[key]);
    }
  }
  if (body.capacity !== undefined) {
    fields.push("capacity = @capacity");
    vals.capacity = body.capacity === null ? null : Number(body.capacity);
  }
  if (!fields.length) return json({ ok: true });
  db.prepare(`UPDATE events SET ${fields.join(", ")} WHERE id = @id`).run(vals);
  logAudit(db, user, "event", id, "update");
  return json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;
  db.prepare("DELETE FROM events WHERE id = ?").run(id);
  logAudit(db, user, "event", id, "delete");
  return json({ ok: true });
}

export const runtime = "nodejs";
