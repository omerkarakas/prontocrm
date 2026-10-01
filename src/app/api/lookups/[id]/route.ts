import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";
import { nowIso } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

const TYPE_COLUMNS: Record<string, string> = { title: "title", city: "city", source: "source" };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const value = String(body?.value ?? "").trim();
  if (!value) return apiError("Değer boş olamaz.");
  if (value.length > 100) return apiError("Değer en fazla 100 karakter olabilir.");

  const row = db.prepare("SELECT id, type, value FROM lookup_values WHERE id = ?").get(id) as
    | { id: string; type: string; value: string }
    | undefined;
  if (!row) return apiError("Kayıt bulunamadı.", 404);

  const col = TYPE_COLUMNS[row.type];
  const dup = db.prepare("SELECT id FROM lookup_values WHERE type = ? AND value = ? AND id != ?").get(row.type, value, id);
  if (dup) return apiError("Bu değer listede zaten var.");

  const rename = db.transaction(() => {
    db.prepare("UPDATE lookup_values SET value = ? WHERE id = ?").run(value, id);
    // bu değeri kullanan kişi kayıtlarını da eşitle
    db.prepare(`UPDATE people SET ${col} = ?, updated_at = ? WHERE ${col} = ?`).run(value, nowIso(), row.value);
  });
  rename();

  logAudit(db, user, "lookup", id, "update", `${row.type}: ${row.value} → ${value}`);
  return json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;

  const row = db.prepare("SELECT id, type, value FROM lookup_values WHERE id = ?").get(id) as
    | { id: string; type: string; value: string }
    | undefined;
  if (!row) return apiError("Kayıt bulunamadı.", 404);

  db.prepare("DELETE FROM lookup_values WHERE id = ?").run(id);
  logAudit(db, user, "lookup", id, "delete", `${row.type}: ${row.value}`);
  return json({ ok: true });
}

export const runtime = "nodejs";
