import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit, sha256 } from "@/lib/server";
import { genId, nowIso } from "@/lib/utils";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const rows = db.prepare("SELECT id, name, prefix, active, last_used_at, created_at FROM api_keys ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return json({
    keys: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      prefix: r.prefix as string,
      active: Boolean(r.active),
      lastUsedAt: (r.last_used_at as string | null) ?? null,
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
  const name = String(body?.name ?? "").trim() || "Yeni anahtar";

  const raw = `pronto_sk_${crypto.randomUUID().replace(/-/g, "")}`;
  const id = genId();
  db.prepare("INSERT INTO api_keys (id, name, key_hash, prefix, active, created_at) VALUES (?,?,?,?,1,?)").run(
    id, name, sha256(raw), raw.slice(0, 18), nowIso()
  );
  logAudit(db, user, "api_key", id, "create", name);
  return json({ id, key: raw }, 201);
}

export const runtime = "nodejs";
