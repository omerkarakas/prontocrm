import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";
import { genId, nowIso } from "@/lib/utils";

const TYPE_COLUMNS: Record<string, string> = { title: "title", city: "city", source: "source" };

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();

  const result: Record<string, Array<{ id: string; value: string; usage: number }>> = {
    title: [],
    city: [],
    source: [],
  };

  for (const [type, col] of Object.entries(TYPE_COLUMNS)) {
    const rows = db
      .prepare(
        `SELECT lv.id, lv.value,
           (SELECT COUNT(*) FROM people p WHERE p.${col} = lv.value) AS usage
         FROM lookup_values lv WHERE lv.type = ?`
      )
      .all(type) as Array<{ id: string; value: string; usage: number }>;
    rows.sort((a, b) => a.value.localeCompare(b.value, "tr"));
    result[type] = rows;
  }

  return json(result);
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const body = await req.json().catch(() => null);
  const type = String(body?.type ?? "");
  const value = String(body?.value ?? "").trim();
  if (!(type in TYPE_COLUMNS)) return apiError("Geçersiz liste türü.");
  if (!value) return apiError("Değer boş olamaz.");
  if (value.length > 100) return apiError("Değer en fazla 100 karakter olabilir.");

  const existing = db.prepare("SELECT id FROM lookup_values WHERE type = ? AND value = ?").get(type, value) as
    | { id: string }
    | undefined;
  if (existing) return json({ id: existing.id, existed: true });

  const id = genId();
  db.prepare("INSERT INTO lookup_values (id, type, value, created_at) VALUES (?,?,?,?)").run(id, type, value, nowIso());
  logAudit(db, user, "lookup", id, "create", `${type}: ${value}`);
  return json({ id }, 201);
}

export const runtime = "nodejs";
