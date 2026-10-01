import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";
import { seed } from "@/lib/seed";

export async function POST() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return apiError("Yönetici yetkisi gerekir.", 403);

  const db = getDb();
  const tables = ["webhook_deliveries", "webhooks", "api_keys", "audit_log", "conversations", "event_participants", "events", "people", "sessions", "settings", "lookup_values"] as const;
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
  seed(db);
  logAudit(db, user, "system", null, "reset", "Demo verisi sıfırlandı");
  return json({ ok: true });
}

export const runtime = "nodejs";
