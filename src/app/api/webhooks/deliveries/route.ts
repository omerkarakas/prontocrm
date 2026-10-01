import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json } from "@/lib/server";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const webhookId = req.nextUrl.searchParams.get("webhookId");
  const rows = webhookId
    ? (db.prepare("SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 20").all(webhookId) as Record<string, unknown>[])
    : (db.prepare("SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT 30").all() as Record<string, unknown>[]);
  return json({
    deliveries: rows.map((r) => ({
      id: r.id as string,
      webhookId: r.webhook_id as string,
      event: r.event as string,
      status: (r.status as number | null) ?? null,
      ok: Boolean(r.ok),
      error: (r.error as string | null) ?? null,
      createdAt: r.created_at as string,
    })),
  });
}

export const runtime = "nodejs";
