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
  if (!body) return apiError("Geçersiz istek.");

  const fields: string[] = [];
  const vals: Record<string, unknown> = { id };
  if (body.name !== undefined) { fields.push("name = @name"); vals.name = String(body.name); }
  if (body.url !== undefined) { fields.push("url = @url"); vals.url = String(body.url); }
  if (body.secret !== undefined) { fields.push("secret = @secret"); vals.secret = String(body.secret); }
  if (body.events !== undefined) { fields.push("events = @events"); vals.events = JSON.stringify(body.events); }
  if (typeof body.active === "boolean") { fields.push("active = @active"); vals.active = body.active ? 1 : 0; }
  if (!fields.length) return json({ ok: true });
  db.prepare(`UPDATE webhooks SET ${fields.join(", ")} WHERE id = @id`).run(vals);
  logAudit(db, user, "webhook", id, "update");
  return json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return apiError("Yönetici yetkisi gerekir.", 403);
  const db = getDb();
  const { id } = await params;
  db.prepare("DELETE FROM webhook_deliveries WHERE webhook_id = ?").run(id);
  db.prepare("DELETE FROM webhooks WHERE id = ?").run(id);
  logAudit(db, user, "webhook", id, "delete");
  return json({ ok: true });
}

export const runtime = "nodejs";
