import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, insertPerson, mergePerson, logAudit, fireWebhooks } from "@/lib/server";
import { nowIso, isValidEmail, genId } from "@/lib/utils";
import type { PersonInput } from "@/lib/types";

interface ImportRow extends PersonInput {
  conversationDate?: string;
  conversationSubject?: string;
  conversationNote?: string;
}

interface ImportBody {
  rows: ImportRow[];
  duplicatePolicy?: "skip" | "update" | "insert";
  defaultSource?: string;
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const body = (await req.json().catch(() => null)) as ImportBody | null;
  if (!body?.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
    return apiError("İçe aktarılacak satır yok.");
  }

  const policy = body.duplicatePolicy ?? "update";
  const defaultSource = body.defaultSource ?? "İçe aktarma";
  const currentUser = user;
  const findExisting = db.prepare("SELECT id FROM people WHERE lower(email) = lower(?) AND email != ''");

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let conversations = 0;
  const invalidEmails: number[] = [];
  const newIds: string[] = [];

  const insertConversation = db.prepare(
    "INSERT INTO conversations (id, person_id, user_id, date, subject, note, created_at) VALUES (?,?,?,?,?,?,?)"
  );

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i];
    const email = String(row.email ?? "").trim().toLowerCase();
    if (email && !isValidEmail(email)) {
      invalidEmails.push(i + 1);
    }

    const input: PersonInput = {
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      email,
      phone: row.phone,
      company: row.company,
      title: row.title,
      city: row.city,
      tags: row.tags,
      notes: row.notes,
      source: row.source || defaultSource,
      ownerId: row.ownerId ?? user.id,
    };

    const existing = email ? (findExisting.get(email) as { id: string } | undefined) : undefined;

    if (existing && policy === "skip") {
      skipped++;
      continue;
    }
    if (existing && policy === "update") {
      mergePerson(db, existing.id, input);
      updated++;
      if (row.conversationDate || row.conversationSubject) {
        addConversation(existing.id, row);
        conversations++;
      }
      continue;
    }
    // insert (veya policy=insert iken mevcut olsa da)
    const id = insertPerson(db, input);
    inserted++;
    newIds.push(id);
    if (row.conversationDate || row.conversationSubject) {
      addConversation(id, row);
      conversations++;
    }
  }

  function addConversation(personId: string, row: ImportRow) {
    let date = nowIso();
    if (row.conversationDate) {
      const d = new Date(row.conversationDate);
      if (!isNaN(d.getTime())) date = d.toISOString();
    }
    insertConversation.run(genId(), personId, currentUser.id, date, String(row.conversationSubject ?? "").trim(), String(row.conversationNote ?? "").trim(), nowIso());
  }

  logAudit(
    db, user, "import", null, "import",
    `${inserted} yeni, ${updated} güncellendi, ${skipped} atlandı`
  );
  if (newIds.length) {
    await fireWebhooks(db, "people.imported", { source: defaultSource, count: newIds.length, ids: newIds.slice(0, 100) });
  }

  return json({ inserted, updated, skipped, conversations, invalidEmails: invalidEmails.length, invalidRows: invalidEmails.slice(0, 20) });
}

export const runtime = "nodejs";
