import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit, fireWebhooks, getPersonById } from "@/lib/server";
import { parseTags } from "@/lib/utils";

type BulkBody = {
  op: "edit" | "delete" | "tag" | "owner";
  edits?: { id: string; field: string; value: string }[];
  ids?: string[];
  tags?: string[];
  ownerId?: string | null;
};

const EDITABLE_FIELDS: Record<string, string> = {
  firstName: "first_name", lastName: "last_name", email: "email", phone: "phone",
  company: "company", title: "title", city: "city", tags: "tags", notes: "notes",
  source: "source", ownerId: "owner_id", ownerName: "", eventNames: "",
};

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const body = (await req.json().catch(() => null)) as BulkBody | null;
  if (!body?.op) return apiError("Geçersiz istek.");

  if (body.op === "edit") {
    const edits = body.edits ?? [];
    const byId = new Map<string, Record<string, string>>();
    for (const e of edits) {
      if (!(e.field in EDITABLE_FIELDS) || e.field === "ownerName" || e.field === "eventNames") continue;
      if (!byId.has(e.id)) byId.set(e.id, {});
      byId.get(e.id)![e.field] = e.value;
    }
    const update = (id: string, fields: Record<string, string>) => {
      const norm: Record<string, unknown> = { ...fields };
      if (norm.ownerId === "") norm.ownerId = null; // boş seçim = sorumlu kaldır
      const sets = Object.entries(fields).map(([f]) => `${EDITABLE_FIELDS[f]} = @${f}`);
      if (!sets.length) return;
      sets.push("updated_at = @now");
      db.prepare(`UPDATE people SET ${sets.join(", ")} WHERE id = @id`).run({ ...norm, id, now: new Date().toISOString() });
    };
    for (const [id, fields] of byId) {
      const before = db.prepare("SELECT * FROM people WHERE id = ?").get(id);
      update(id, fields);
      if (before) {
        logAudit(db, user, "person", id, "update", "Hızlı düzenleme", Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [null, v]])));
      }
    }
    const updatedIds = [...byId.keys()];
    if (updatedIds.length) {
      const people = updatedIds.map((id) => getPersonById(db, id));
      await fireWebhooks(db, "person.updated", people.length === 1 ? people[0] : { count: people.length, ids: updatedIds });
    }
    return json({ ok: true, updated: updatedIds.length });
  }

  if (body.op === "delete") {
    const ids = body.ids ?? [];
    for (const id of ids) {
      const p = getPersonById(db, id);
      if (p) {
        db.prepare("DELETE FROM people WHERE id = ?").run(id);
        logAudit(db, user, "person", id, "delete", `${p.firstName} ${p.lastName}`);
      }
    }
    await fireWebhooks(db, "person.deleted", { count: ids.length, ids });
    return json({ ok: true, deleted: ids.length });
  }

  if (body.op === "tag") {
    const ids = body.ids ?? [];
    const newTags = (body.tags ?? []).join(", ");
    for (const id of ids) {
      const row = db.prepare("SELECT tags FROM people WHERE id = ?").get(id) as { tags: string } | undefined;
      if (!row) continue;
      const existing = parseTags(row.tags);
      const merged = [...new Set([...existing, ...(body.tags ?? [])])];
      db.prepare("UPDATE people SET tags = ?, updated_at = ? WHERE id = ?").run(merged.join(", "), new Date().toISOString(), id);
      logAudit(db, user, "person", id, "update", `Etiket eklendi: ${newTags}`);
    }
    await fireWebhooks(db, "person.updated", { count: ids.length, ids, change: { tags: body.tags } });
    return json({ ok: true, updated: ids.length });
  }

  if (body.op === "owner") {
    const ids = body.ids ?? [];
    for (const id of ids) {
      db.prepare("UPDATE people SET owner_id = ?, updated_at = ? WHERE id = ?").run(body.ownerId || null, new Date().toISOString(), id);
      logAudit(db, user, "person", id, "update", "Sorumlu güncellendi");
    }
    await fireWebhooks(db, "person.updated", { count: ids.length, ids, change: { ownerId: body.ownerId } });
    return json({ ok: true, updated: ids.length });
  }

  return apiError("Bilinmeyen işlem.");
}

export const runtime = "nodejs";
