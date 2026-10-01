import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id, personId } = await params;
  const body = await req.json().catch(() => null);
  const valid = ["registered", "attended", "cancelled", "waitlist"];
  if (!body?.status || !valid.includes(body.status)) return apiError("Geçersiz durum.");
  db.prepare("UPDATE event_participants SET status = ? WHERE event_id = ? AND person_id = ?").run(body.status, id, personId);
  logAudit(db, user, "event", id, "update", `Katılımcı durumu: ${body.status}`);
  return json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id, personId } = await params;
  db.prepare("DELETE FROM event_participants WHERE event_id = ? AND person_id = ?").run(id, personId);
  logAudit(db, user, "event", id, "update", "Katılımcı çıkarıldı");
  return json({ ok: true });
}

export const runtime = "nodejs";
