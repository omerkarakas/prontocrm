import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";
import { nowIso } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return apiError("Geri yükleme için yönetici yetkisi gerekir.", 403);

  const body = await req.json().catch(() => null);
  if (!body?.meta?.app || body.meta.app !== "pronto-crm") {
    return apiError("Bu dosya bir Pronto CRM yedeği değil.");
  }

  const db = getDb();
  const tables = ["webhook_deliveries", "webhooks", "api_keys", "audit_log", "conversations", "event_participants", "events", "people", "sessions", "settings", "lookup_values", "users"] as const;

  const restore = db.transaction(() => {
    for (const t of tables) {
      if (Array.isArray(body[t])) {
        db.prepare(`DELETE FROM ${t}`).run();
      }
    }
    const insertFor = (t: string, cols: string[]) => {
      const stmt = db.prepare(`INSERT INTO ${t} (${cols.join(",")}) VALUES (${cols.map((c) => `@${c}`).join(",")})`);
      return (row: Record<string, unknown>) => {
        const params: Record<string, unknown> = {};
        for (const c of cols) params[c] = row[c] ?? null;
        stmt.run(params);
      };
    };
    const maps: Record<string, string[]> = {
      users: ["id", "name", "email", "password_hash", "role", "active", "created_at"],
      people: ["id", "first_name", "last_name", "email", "phone", "company", "title", "city", "tags", "notes", "source", "owner_id", "created_at", "updated_at"],
      events: ["id", "name", "date", "location", "description", "status", "capacity", "created_at"],
      event_participants: ["event_id", "person_id", "status", "registered_at"],
      conversations: ["id", "person_id", "user_id", "date", "subject", "note", "created_at"],
      settings: ["key", "value"],
      lookup_values: ["id", "type", "value", "created_at"],
    };
    for (const [t, cols] of Object.entries(maps)) {
      if (Array.isArray(body[t])) {
        const ins = insertFor(t, cols);
        for (const row of body[t] as Record<string, unknown>[]) ins(row);
      }
    }
  });

  try {
    restore();
  } catch (e) {
    return apiError(`Geri yükleme başarısız: ${e instanceof Error ? e.message : "bilinmeyen hata"}`, 500);
  }

  logAudit(db, user, "system", null, "restore", `Yedek geri yüklendi (${body.meta.exportedAt ?? "tarih yok"})`);
  return json({ ok: true, restoredAt: nowIso() });
}

export const runtime = "nodejs";
