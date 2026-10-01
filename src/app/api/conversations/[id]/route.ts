import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;
  const row = db.prepare("SELECT id, person_id FROM conversations WHERE id = ?").get(id) as { person_id: string } | undefined;
  if (!row) return apiError("Görüşme bulunamadı.", 404);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  logAudit(db, user, "conversation", id, "delete");
  return json({ ok: true });
}

export const runtime = "nodejs";
