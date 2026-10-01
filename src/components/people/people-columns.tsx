"use client";

import * as React from "react";
import { ChevronRight, Mail, Phone } from "lucide-react";
import type { GridColumn, GridDensity } from "@/components/data-grid/data-grid";
import { Badge } from "@/components/ui/badge";
import { daysAgo, formatRelative, formatPhone, personName } from "@/lib/utils";
import type { Person } from "@/lib/types";

/** Son görüşmeye göre renk: taze = yeşil, biraz eski = amber, çok eski = kırmızı, hiç = gri */
export function convoHealth(lastAt: string | null): "fresh" | "ok" | "stale" | "none" {
  const d = daysAgo(lastAt);
  if (d === null) return "none";
  if (d <= 30) return "fresh";
  if (d <= 90) return "ok";
  return "stale";
}

const DOT: Record<string, string> = {
  fresh: "bg-emerald-500",
  ok: "bg-amber-500",
  stale: "bg-rose-500",
  none: "bg-zinc-300 dark:bg-zinc-700",
};

export function buildPeopleColumns(opts: {
  users: { id: string; name: string }[];
  onOpen: (p: Person) => void;
  onAction: (p: Person, action: string) => void;
  density: GridDensity;
  lookups: { title: string[]; city: string[]; source: string[] };
}): GridColumn<Person>[] {
  const { users, onOpen, lookups } = opts;

  const cols: GridColumn<Person>[] = [
    { key: "__select", label: "", width: 38, sticky: true, render: () => null },
    { key: "__index", label: "#", width: 46, sticky: true, align: "right", render: () => null },
    {
      key: "firstName",
      label: "Ad",
      width: 140,
      editable: true,
      sticky: true,
      render: (p) => (
        <button
          className="group/name flex min-w-0 items-center gap-0.5 text-left"
          onClick={() => onOpen(p)}
          title={`${personName(p)} — detayları aç (Shift+Enter)`}
        >
          <span className="truncate font-medium text-primary underline-offset-2 group-hover/name:underline">
            {p.firstName || "(boş)"}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 text-primary/70 transition-opacity group-hover/name:opacity-100" />
        </button>
      ),
    },
    { key: "lastName", label: "Soyad", width: 150, editable: true, sticky: true, render: (p) => <span className="truncate">{p.lastName}</span> },
    {
      key: "email",
      label: "E-posta",
      width: 230,
      type: "email",
      editable: true,
      render: (p) =>
        p.email ? (
          <a href={`mailto:${p.email}`} className="truncate text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {p.email}
          </a>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
      stringValue: (p) => p.email,
    },
    {
      key: "phone",
      label: "Telefon",
      width: 155,
      type: "phone",
      editable: true,
      render: (p) =>
        p.phone ? (
          <a href={`tel:${p.phone}`} className="truncate tabular-nums hover:underline" onClick={(e) => e.stopPropagation()}>
            {formatPhone(p.phone)}
          </a>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
      stringValue: (p) => formatPhone(p.phone),
    },
    { key: "company", label: "Şirket", width: 170, editable: true, render: (p) => <span className="truncate">{p.company}</span> },
    {
      key: "title",
      label: "Ünvan",
      width: 160,
      editable: true,
      type: "select",
      options: lookups.title.map((v) => ({ value: v, label: v })),
      render: (p) => <span className="truncate">{p.title}</span>,
    },
    {
      key: "city",
      label: "Şehir",
      width: 110,
      editable: true,
      type: "select",
      options: lookups.city.map((v) => ({ value: v, label: v })),
      render: (p) => <span className="truncate">{p.city}</span>,
    },
    {
      key: "tags",
      label: "Etiketler",
      width: 180,
      type: "tags",
      editable: true,
      render: (p) => (
        <div className="flex items-center gap-1 overflow-hidden">
          {p.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="accent" className="shrink-0 text-[10px]">
              {t}
            </Badge>
          ))}
          {p.tags.length > 2 && <span className="shrink-0 text-[10px] text-muted-foreground">+{p.tags.length - 2}</span>}
          {p.tags.length === 0 && <span className="text-muted-foreground/50">—</span>}
        </div>
      ),
      stringValue: (p) => p.tags.join(", "),
    },
    {
      key: "lastConversationAt",
      label: "Son görüşme",
      width: 150,
      render: (p) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[convoHealth(p.lastConversationAt)]}`} />
          {p.lastConversationAt ? formatRelative(p.lastConversationAt) : "hiç yok"}
        </span>
      ),
      stringValue: (p) => (p.lastConversationAt ? formatRelative(p.lastConversationAt) : ""),
    },
    {
      key: "lastConversationSubject",
      label: "Son görüşme konusu",
      width: 230,
      render: (p) => (
        <span className="truncate">
          {p.lastConversationSubject ? (
            <span>
              {p.lastConversationSubject}
              {p.lastConversationUser && <span className="ml-1.5 text-[11px] text-muted-foreground">({p.lastConversationUser})</span>}
            </span>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </span>
      ),
      stringValue: (p) => p.lastConversationSubject ?? "",
    },
    {
      key: "conversationCount",
      label: "Görüşme",
      width: 84,
      align: "right",
      render: (p) => <span className="tabular-nums text-muted-foreground">{p.conversationCount}</span>,
      stringValue: (p) => String(p.conversationCount),
    },
    {
      key: "eventNames",
      label: "Etkinlikler",
      width: 200,
      render: (p) => {
        if (!p.eventNames) return <span className="text-muted-foreground/50">—</span>;
        const names = p.eventNames.split("\n");
        return (
          <span className="truncate" title={names.join(", ")}>
            {names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`}
          </span>
        );
      },
      stringValue: (p) => (p.eventNames ?? "").replace(/\n/g, ", "),
    },
    {
      key: "ownerName",
      label: "Sorumlu",
      width: 140,
      type: "select",
      editable: true,
      options: users.map((u) => ({ value: u.id, label: u.name })),
      render: (p) => <span className="truncate text-muted-foreground">{p.ownerName ?? "—"}</span>,
      stringValue: (p) => p.ownerName ?? "",
    },
    {
      key: "source",
      label: "Kaynak",
      width: 130,
      editable: true,
      type: "select",
      options: lookups.source.map((v) => ({ value: v, label: v })),
      render: (p) => <span className="truncate text-muted-foreground">{p.source}</span>,
    },
    {
      key: "createdAt",
      label: "Eklenme",
      width: 110,
      render: (p) => <span className="tabular-nums text-muted-foreground">{formatDateCell(p.createdAt)}</span>,
      stringValue: (p) => formatDateCell(p.createdAt),
    },
    {
      key: "__actions",
      label: "",
      width: 48,
      render: () => null,
    },
  ];

  return cols;
}

function formatDateCell(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(iso));
}

/** Satır eylem menüsü içeriği (menü üst bileşende açılır) */
export const PERSON_ROW_ACTIONS = [
  { id: "detail", label: "Detayları aç", icon: ChevronRight },
  { id: "call", label: "Ara", icon: Phone },
  { id: "mail", label: "E-posta gönder", icon: Mail },
];

export function personActionHref(p: Person, action: string): string | null {
  if (action === "call") return p.phone ? `tel:${p.phone}` : null;
  if (action === "mail") return p.email ? `mailto:${p.email}` : null;
  return null;
}
