import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";
import { genId, nowIso } from "@/lib/utils";
import type { EventStatus } from "@/lib/types";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status != 'cancelled') AS participant_count,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'attended') AS attended_count
       FROM events e ORDER BY e.date DESC`
    )
    .all() as Record<string, unknown>[];
  return json({
    events: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      date: r.date as string,
      location: (r.location as string) ?? "",
      description: (r.description as string) ?? "",
      status: r.status as EventStatus,
      capacity: (r.capacity as number | null) ?? null,
      createdAt: r.created_at as string,
      participantCount: (r.participant_count as number) ?? 0,
      attendedCount: (r.attended_count as number) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return apiError("Etkinlik adı gerekli.");
  const id = genId();
  db.prepare(
    "INSERT INTO events (id, name, date, location, description, status, capacity, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run(id, String(body.name).trim(), String(body.date ?? nowIso().slice(0, 10)), String(body.location ?? "").trim(), String(body.description ?? "").trim(), String(body.status ?? "planned"), body.capacity ?? null, nowIso());
  logAudit(db, user, "event", id, "create", String(body.name).trim());
  return json({ id }, 201);
}

export const runtime = "nodejs";
