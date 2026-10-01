import "server-only";
import { NextResponse } from "next/server";
import crypto from "crypto";
import type Database from "better-sqlite3";
import { getDb } from "./db";
import { sha256 } from "./auth";
import type { PersonInput, User } from "./types";
import { genId, normalizePhone, nowIso, parseTags } from "./utils";

export { requireApiUser, sha256, hashPassword } from "./auth";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized() {
  return apiError("Oturum bulunamadı. Lütfen giriş yapın.", 401);
}

// ---------- denetim kaydı ----------

export function logAudit(
  db: Database.Database,
  user: { id: string; name: string } | null,
  entity: string,
  entityId: string | null,
  action: string,
  summary?: string,
  changes?: Record<string, [unknown, unknown]>
) {
  db.prepare(
    "INSERT INTO audit_log (id, user_id, user_name, entity, entity_id, action, summary, changes, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(genId(), user?.id ?? null, user?.name ?? null, entity, entityId, action, summary ?? null, changes ? JSON.stringify(changes) : null, nowIso());
}

// ---------- webhook gönderimi ----------

export async function fireWebhooks(db: Database.Database, event: string, data: unknown) {
  const webhooks = db.prepare("SELECT * FROM webhooks WHERE active = 1").all() as Array<{
    id: string; name: string; url: string; secret: string; events: string;
  }>;
  const targets = webhooks.filter((w) => {
    try { return (JSON.parse(w.events) as string[]).includes(event); } catch { return false; }
  });
  if (targets.length === 0) return;

  const payload = JSON.stringify({ event, timestamp: nowIso(), data });
  const insertDelivery = db.prepare(
    "INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status, ok, error, created_at) VALUES (?,?,?,?,?,?,?,?)"
  );

  await Promise.allSettled(
    targets.map(async (w) => {
      const signature = crypto.createHmac("sha256", w.secret).update(payload).digest("hex");
      let status: number | null = null;
      let ok = false;
      let error: string | null = null;
      try {
        const res = await fetch(w.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Pronto-Event": event,
            "X-Pronto-Signature": `sha256=${signature}`,
          },
          body: payload,
          signal: AbortSignal.timeout(5000),
        });
        status = res.status;
        ok = res.ok;
      } catch (e) {
        error = e instanceof Error ? e.message : "bilinmeyen hata";
      }
      insertDelivery.run(genId(), w.id, event, payload.slice(0, 4000), status, ok ? 1 : 0, error, nowIso());
    })
  );
}

// ---------- kişi CRUD ortak mantığı ----------

const PERSON_FIELDS = [
  "firstName", "lastName", "email", "phone", "company", "title", "city", "tags", "notes", "source",
] as const;

const colFromField: Record<string, string> = {
  firstName: "first_name", lastName: "last_name", email: "email", phone: "phone",
  company: "company", title: "title", city: "city", tags: "tags", notes: "notes", source: "source",
  ownerId: "owner_id",
};

export function normalizePersonInput(input: PersonInput): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const f of PERSON_FIELDS) {
    const v = (input as Record<string, unknown>)[f];
    if (v === undefined) continue;
    if (f === "tags") out.tags = Array.isArray(v) ? v.join(", ") : parseTags(String(v)).join(", ");
    else if (f === "phone") out.phone = normalizePhone(v == null ? "" : String(v));
    else out[f] = v == null ? "" : String(v).trim();
  }
  if (input.ownerId !== undefined) out.ownerId = input.ownerId || null;
  return out;
}

export function insertPerson(db: Database.Database, input: PersonInput): string {
  const n = normalizePersonInput(input);
  const id = genId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO people (id, first_name, last_name, email, phone, company, title, city, tags, notes, source, owner_id, created_at, updated_at)
     VALUES (@id, @firstName, @lastName, @email, @phone, @company, @title, @city, @tags, @notes, @source, @ownerId, @now, @now)`
  ).run({
    id,
    firstName: n.firstName ?? "",
    lastName: n.lastName ?? "",
    email: n.email ?? "",
    phone: n.phone ?? "",
    company: n.company ?? "",
    title: n.title ?? "",
    city: n.city ?? "",
    tags: n.tags ?? "",
    notes: n.notes ?? "",
    source: n.source ?? "",
    ownerId: n.ownerId ?? null,
    now,
  });
  return id;
}

/** Var olan kişiyi, boş olan hedef alanları doldurarak günceller. Değişen alan adlarını döner. */
export function mergePerson(db: Database.Database, id: string, input: PersonInput): string[] {
  const current = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!current) return [];
  const n = normalizePersonInput(input);
  const updates: string[] = [];
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const [field, value] of Object.entries(n)) {
    if (value === null || value === undefined || value === "") continue;
    const col = colFromField[field];
    const cur = current[col];
    if (cur === null || cur === "" || cur === undefined) {
      sets.push(`${col} = @${field}`);
      params[field] = value;
      updates.push(field);
    }
  }
  if (sets.length === 0) return [];
  sets.push("updated_at = @now");
  params.now = nowIso();
  db.prepare(`UPDATE people SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return updates;
}

export const PERSON_SUMMARY_SELECT = `
  SELECT p.*,
    u.name AS owner_name,
    (SELECT MAX(c.date) FROM conversations c WHERE c.person_id = p.id) AS last_conversation_at,
    (SELECT c.subject FROM conversations c WHERE c.person_id = p.id ORDER BY c.date DESC LIMIT 1) AS last_conversation_subject,
    (SELECT cu.name FROM conversations c LEFT JOIN users cu ON cu.id = c.user_id WHERE c.person_id = p.id ORDER BY c.date DESC LIMIT 1) AS last_conversation_user,
    (SELECT COUNT(*) FROM conversations c WHERE c.person_id = p.id) AS conversation_count,
    (SELECT GROUP_CONCAT(e.name, char(10)) FROM event_participants ep JOIN events e ON e.id = ep.event_id WHERE ep.person_id = p.id) AS event_names
  FROM people p LEFT JOIN users u ON u.id = p.owner_id
`;

type RawPerson = Record<string, unknown>;

export function mapPersonRow(r: RawPerson) {
  return {
    id: r.id as string,
    firstName: (r.first_name as string) ?? "",
    lastName: (r.last_name as string) ?? "",
    email: (r.email as string) ?? "",
    phone: (r.phone as string) ?? "",
    company: (r.company as string) ?? "",
    title: (r.title as string) ?? "",
    city: (r.city as string) ?? "",
    tags: parseTags((r.tags as string) ?? ""),
    notes: (r.notes as string) ?? "",
    source: (r.source as string) ?? "",
    ownerId: (r.owner_id as string | null) ?? null,
    ownerName: (r.owner_name as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lastConversationAt: (r.last_conversation_at as string | null) ?? null,
    lastConversationSubject: (r.last_conversation_subject as string | null) ?? null,
    lastConversationUser: (r.last_conversation_user as string | null) ?? null,
    conversationCount: (r.conversation_count as number) ?? 0,
    eventNames: (r.event_names as string | null) ?? null,
  };
}

export function getPersonById(db: Database.Database, id: string) {
  const row = db.prepare(`${PERSON_SUMMARY_SELECT} WHERE p.id = ?`).get(id) as RawPerson | undefined;
  return row ? mapPersonRow(row) : null;
}

// ---------- API anahtarı doğrulama ----------

export function checkApiKey(db: Database.Database, req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-api-key") || "";
  if (!key) return false;
  const row = db.prepare("SELECT id, active FROM api_keys WHERE key_hash = ?").get(sha256(key)) as
    | { id: string; active: number }
    | undefined;
  if (!row || !row.active) return false;
  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(nowIso(), row.id);
  return true;
}

export function computeChanges(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const key of Object.keys(after)) {
    const b = before[key];
    const a = after[key];
    const bs = b instanceof Date ? b.toISOString() : b;
    const as = a instanceof Date ? a.toISOString() : a;
    if (String(bs ?? "") !== String(as ?? "")) changes[key] = [bs ?? null, as ?? null];
  }
  return changes;
}

export type { User };
