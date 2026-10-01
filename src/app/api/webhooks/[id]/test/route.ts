import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError } from "@/lib/server";
import { genId, nowIso } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const { id } = await params;

  const hook = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as
    | { id: string; url: string; secret: string }
    | undefined;
  if (!hook) return apiError("Webhook bulunamadı.", 404);

  const payload = JSON.stringify({
    event: "test",
    timestamp: nowIso(),
    data: { message: "Pronto CRM test bildirimi", hookId: id, user: user.name },
  });
  const signature = crypto.createHmac("sha256", hook.secret).update(payload).digest("hex");

  let status: number | null = null;
  let ok = false;
  let error: string | null = null;
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pronto-Event": "test",
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

  db.prepare(
    "INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status, ok, error, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run(genId(), id, "test", payload, status, ok ? 1 : 0, error, nowIso());

  return json({ ok, status, error });
}

export const runtime = "nodejs";
