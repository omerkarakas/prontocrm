import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireApiUser, unauthorized, mapPersonRow, PERSON_SUMMARY_SELECT } from "@/lib/server";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const db = getDb();
  const scope = req.nextUrl.searchParams.get("scope") ?? "all";
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv" && scope === "people") {
    const rows = db.prepare(`${PERSON_SUMMARY_SELECT} ORDER BY p.created_at`).all() as Record<string, unknown>[];
    const headers = ["Ad", "Soyad", "E-posta", "Telefon", "Şirket", "Ünvan", "Şehir", "Etiketler", "Kaynak", "Sorumlu", "Son Görüşme", "Son Görüşme Konusu", "Görüşme Sayısı", "Notlar", "Eklenme"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      const p = mapPersonRow(r);
      lines.push([p.firstName, p.lastName, p.email, p.phone, p.company, p.title, p.city, p.tags.join(", "), p.source, p.ownerName ?? "", p.lastConversationAt ?? "", p.lastConversationSubject ?? "", p.conversationCount, p.notes, p.createdAt].map(esc).join(","));
    }
    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pronto-kisiler-${stamp}.csv"`,
      },
    });
  }

  const data: Record<string, unknown> = {
    meta: { app: "pronto-crm", version: 1, exportedAt: new Date().toISOString(), exportedBy: user.email, scope },
  };
  const tables = ["users", "people", "events", "event_participants", "conversations", "settings"];
  for (const t of tables) {
    data[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="pronto-yedek-${stamp}.json"`,
    },
  });
}

export const runtime = "nodejs";
