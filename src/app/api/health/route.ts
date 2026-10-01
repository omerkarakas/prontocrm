import { json } from "@/lib/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const people = (db.prepare("SELECT COUNT(*) AS c FROM people").get() as { c: number }).c;
  return json({ ok: true, people, time: new Date().toISOString() });
}

export const runtime = "nodejs";
