import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return apiError("Yönetici yetkisi gerekir.", 403);
  const db = getDb();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.active === "boolean") {
    db.prepare("UPDATE api_keys SET active = ? WHERE id = ?").run(body.active ? 1 : 0, id);
    logAudit(db, user, "api_key", id, "update", body.active ? "Etkinleştirildi" : "Devre dışı bırakıldı");
  }
  return json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return apiError("Yönetici yetkisi gerekir.", 403);
  const db = getDb();
  const { id } = await params;
  db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  logAudit(db, user, "api_key", id, "delete");
  return json({ ok: true });
}

export const runtime = "nodejs";
