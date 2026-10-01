import { NextRequest } from "next/server";
import { getDb, getSetting, setSetting } from "@/lib/db";
import { requireApiUser, unauthorized, json, apiError, logAudit } from "@/lib/server";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  return json({ orgName: getSetting(db, "orgName") ?? "Pronto Etkinlik", autoBackup: getSetting(db, "autoBackup") ?? "off" });
}

export async function PUT(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const body = await req.json().catch(() => null);
  if (!body) return apiError("Geçersiz istek.");
  if (typeof body.orgName === "string" && body.orgName.trim()) {
    setSetting(db, "orgName", body.orgName.trim());
    logAudit(db, user, "settings", "orgName", "update", body.orgName.trim());
  }
  if (typeof body.autoBackup === "string") {
    setSetting(db, "autoBackup", body.autoBackup === "on" ? "on" : "off");
  }
  return json({ ok: true });
}

export const runtime = "nodejs";
