import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { apiError, json, logAudit } from "@/lib/server";
import { nowIso } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) return apiError("E-posta ve şifre gerekli.");

  const db = getDb();
  const user = db
    .prepare("SELECT id, name, email, role, active, password_hash, created_at FROM users WHERE lower(email) = lower(?)")
    .get(String(body.email).trim()) as
    | { id: string; name: string; email: string; role: string; active: number; password_hash: string; created_at: string }
    | undefined;

  if (!user || !verifyPassword(String(body.password), user.password_hash)) {
    return apiError("E-posta veya şifre hatalı.", 401);
  }
  if (!user.active) return apiError("Hesabınız devre dışı bırakılmış.", 403);

  await createSession(user.id, Boolean(body.remember));
  logAudit(db, user, "auth", user.id, "login");

  return json({ id: user.id, name: user.name, email: user.email, role: user.role, active: true, createdAt: user.created_at, loggedInAt: nowIso() });
}
