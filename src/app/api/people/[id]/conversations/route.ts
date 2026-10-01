import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit, fireWebhooks } from "@/lib/server";
import { genId, nowIso } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError("Geçersiz istek.");

  const person = db.prepare("SELECT id FROM people WHERE id = ?").get(id);
  if (!person) return apiError("Kişi bulunamadı.", 404);

  const convoId = genId();
  const date = body.date ? new Date(body.date) : new Date();
  if (isNaN(date.getTime())) return apiError("Geçersiz tarih.");
  // saat bilgisi yoksa şu anki saati koru
  db.prepare(
    "INSERT INTO conversations (id, person_id, user_id, date, subject, note, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(convoId, id, body.userId ?? user.id, date.toISOString(), String(body.subject ?? "").trim(), String(body.note ?? "").trim(), nowIso());

  db.prepare("UPDATE people SET updated_at = ? WHERE id = ?").run(nowIso(), id);
  logAudit(db, user, "conversation", convoId, "create", String(body.subject ?? "").trim());
  const created = db
    .prepare("SELECT c.*, u.name AS user_name FROM conversations c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?")
    .get(convoId);
  await fireWebhooks(db, "conversation.created", { personId: id, conversation: created });
  return json(created, 201);
}

export const runtime = "nodejs";
