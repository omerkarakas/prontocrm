import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit, hashPassword } from "@/lib/server";
import { genId, nowIso, isValidEmail } from "@/lib/utils";
import type { Role } from "@/lib/types";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const rows = db.prepare("SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at").all() as Record<string, unknown>[];
  return json({
    users: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      email: r.email as string,
      role: r.role as Role,
      active: Boolean(r.active),
      createdAt: r.created_at as string,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return apiError("Kullanıcı ekleme için yönetici yetkisi gerekir.", 403);

  const db = getDb();
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!body?.name?.trim() || !email || !isValidEmail(email)) return apiError("Geçerli ad ve e-posta gerekli.");
  if (!body.password || String(body.password).length < 6) return apiError("Şifre en az 6 karakter olmalı.");

  const exists = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email);
  if (exists) return apiError("Bu e-posta zaten kayıtlı.");

  const id = genId();
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, active, created_at) VALUES (?,?,?,?,?,1,?)").run(
    id, String(body.name).trim(), email, hashPassword(String(body.password)), body.role === "admin" ? "admin" : "member", nowIso()
  );
  logAudit(db, user, "user", id, "create", String(body.name).trim());
  return json({ id }, 201);
}

export const runtime = "nodejs";
