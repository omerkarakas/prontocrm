import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit, hashPassword } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return apiError("Yönetici yetkisi gerekir.", 403);

  const db = getDb();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError("Geçersiz istek.");

  const target = db.prepare("SELECT id, role, active FROM users WHERE id = ?").get(id) as { id: string; role: string; active: number } | undefined;
  if (!target) return apiError("Kullanıcı bulunamadı.", 404);

  if (body.active !== undefined) {
    if (!body.active && target.id === user.id) return apiError("Kendinizi devre dışı bırakamazsınız.");
    if (!body.active && target.role === "admin") {
      const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number };
      if (admins.c <= 1) return apiError("Son aktif yönetici devre dışı bırakılamaz.");
    }
    db.prepare("UPDATE users SET active = ? WHERE id = ?").run(body.active ? 1 : 0, id);
    if (!body.active) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  }
  if (body.role !== undefined) {
    if (target.id === user.id && body.role !== "admin") {
      const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number };
      if (admins.c <= 1) return apiError("Son yönetici rolü değiştirilemez.");
    }
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(body.role === "admin" ? "admin" : "member", id);
  }
  if (body.name !== undefined) {
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(String(body.name).trim(), id);
  }
  if (body.password) {
    if (String(body.password).length < 6) return apiError("Şifre en az 6 karakter olmalı.");
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(String(body.password)), id);
  }

  logAudit(db, user, "user", id, "update");
  return json({ ok: true });
}

export const runtime = "nodejs";
