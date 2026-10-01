import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";
import { nowIso } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const personIds: string[] = Array.isArray(body?.personIds) ? body.personIds : [];
  if (!personIds.length) return apiError("Kişi seçilmedi.");

  const insert = db.prepare(
    "INSERT OR IGNORE INTO event_participants (event_id, person_id, status, registered_at) VALUES (?,?,'registered',?)"
  );
  let added = 0;
  for (const pid of personIds) {
    const res = insert.run(id, pid, nowIso());
    added += res.changes;
  }
  logAudit(db, user, "event", id, "update", `${added} katılımcı eklendi`);
  return json({ ok: true, added });
}

export const runtime = "nodejs";
