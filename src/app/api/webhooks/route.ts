import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";
import { genId, nowIso } from "@/lib/utils";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const rows = db.prepare("SELECT * FROM webhooks ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return json({
    webhooks: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      url: r.url as string,
      secret: r.secret as string,
      events: JSON.parse((r.events as string) ?? "[]"),
      active: Boolean(r.active),
      createdAt: r.created_at as string,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return apiError("Yönetici yetkisi gerekir.", 403);
  const db = getDb();
  const body = await req.json().catch(() => null);
  if (!body?.url || !/^https?:\/\//.test(String(body.url))) return apiError("Geçerli bir webhook adresi gerekli.");

  const id = genId();
  db.prepare("INSERT INTO webhooks (id, name, url, secret, events, active, created_at) VALUES (?,?,?,?,?,?,?)").run(
    id,
    String(body.name ?? "").trim() || "Webhook",
    String(body.url),
    String(body.secret ?? "") || crypto.randomUUID().replace(/-/g, ""),
    JSON.stringify(Array.isArray(body.events) ? body.events : []),
    body.active === false ? 0 : 1,
    nowIso()
  );
  logAudit(db, user, "webhook", id, "create");
  return json({ id }, 201);
}

export const runtime = "nodejs";
