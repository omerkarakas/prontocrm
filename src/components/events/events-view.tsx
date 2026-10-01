"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Plus } from "lucide-react";
import { DataGrid, useColumnState, type GridColumn } from "@/components/data-grid/data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPatch, apiPost } from "@/lib/client-api";
import { EVENT_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { sortRowsBy } from "@/lib/table-utils";
import type { CrmEvent, SortState } from "@/lib/types";

const STATUS_BADGE: Record<string, string> = {
  planned: "secondary",
  ongoing: "success",
  completed: "muted",
  cancelled: "destructive",
};

export function EventsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortState>(null);
  const { data, isLoading } = useQuery({ queryKey: ["events"], queryFn: () => apiGet<{ events: CrmEvent[] }>("/api/events") });
  const events = data?.events ?? [];

  const rows = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    let out = events;
    if (q) out = out.filter((e) => `${e.name} ${e.location} ${e.description}`.toLocaleLowerCase("tr").includes(q));
    if (statusFilter !== "all") out = out.filter((e) => e.status === statusFilter);
    return sortRowsBy(out, sort, (e, key) => {
      const v = (e as unknown as Record<string, unknown>)[key];
      if (typeof v === "number") return v;
      return v == null || v === "" ? null : String(v);
    });
  }, [events, search, statusFilter, sort]);

  const columns: GridColumn<CrmEvent>[] = React.useMemo(
    () => [
      { key: "__index", label: "#", width: 46, sticky: true, align: "right", render: () => null },
      {
        key: "name",
        label: "Etkinlik",
        width: 320,
        editable: true,
        sticky: true,
        render: (e) => (
          <button
            className="group/name flex min-w-0 items-center gap-0.5 text-left"
            onClick={() => router.push(`/etkinlikler/${e.id}`)}
            title={`${e.name} — katılımcıları aç (Shift+Enter)`}
          >
            <span className="truncate font-medium text-primary underline-offset-2 group-hover/name:underline">
              {e.name}
            </span>
            <ChevronRight className="h-3 w-3 shrink-0 text-primary/70 transition-opacity group-hover/name:opacity-100" />
          </button>
        ),
      },
      {
        key: "date",
        label: "Tarih",
        width: 130,
        type: "date",
        editable: true,
        render: (e) => <span className="tabular-nums">{formatDate(e.date)}</span>,
        stringValue: (e) => e.date,
      },
      { key: "location", label: "Yer", width: 220, editable: true, render: (e) => <span className="truncate">{e.location}</span> },
      {
        key: "status",
        label: "Durum",
        width: 140,
        type: "select",
        editable: true,
        options: EVENT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
        render: (e) => <Badge variant={(STATUS_BADGE[e.status] ?? "secondary") as "secondary"}>{EVENT_STATUSES.find((s) => s.value === e.status)?.label ?? e.status}</Badge>,
        stringValue: (e) => EVENT_STATUSES.find((s) => s.value === e.status)?.label ?? e.status,
      },
      { key: "capacity", label: "Kapasite", width: 100, editable: true, align: "right", render: (e) => <span className="tabular-nums">{e.capacity ?? "—"}</span>, stringValue: (e) => (e.capacity == null ? "" : String(e.capacity)) },
      {
        key: "participantCount",
        label: "Katılımcı",
        width: 100,
        align: "right",
        render: (e) => <span className="tabular-nums">{e.participantCount ?? 0}</span>,
        stringValue: (e) => String(e.participantCount ?? 0),
      },
      {
        key: "attendedCount",
        label: "Katıldı",
        width: 90,
        align: "right",
        render: (e) => <span className="tabular-nums text-muted-foreground">{e.attendedCount ?? 0}</span>,
        stringValue: (e) => String(e.attendedCount ?? 0),
      },
      { key: "description", label: "Açıklama", width: 280, editable: true, render: (e) => <span className="truncate text-muted-foreground">{e.description}</span> },
    ],
    [router]
  );

  const { widths, setWidths, visibleColumns } = useColumnState("pronto:events", columns);

  const patchEvent = (id: string, patch: Partial<CrmEvent>) => {
    queryClient.setQueryData<{ events: CrmEvent[] }>(["events"], (old) =>
      old ? { ...old, events: old.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : old
    );
  };

  const handleEditCell = async (row: CrmEvent, col: GridColumn<CrmEvent>, value: string): Promise<boolean> => {
    const patch: Partial<CrmEvent> =
      col.key === "capacity" ? { capacity: value === "" ? null : Number(value) } : ({ [col.key]: value } as Partial<CrmEvent>);
    patchEvent(row.id, patch);
    try {
      await apiPatch(`/api/events/${row.id}`, patch);
      return true;
    } catch {
      toast.error("Güncellenemedi");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      return false;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Etkinlik, yer ara…"
          className="h-8 w-60"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          Ada tıklayınca katılımcı listesi açılır; başlığa tıklayınca sıralanır.
        </span>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Yeni etkinlik
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Yükleniyor…</div>
      ) : (
        <DataGrid
          className="flex-1"
          rows={rows}
          columns={visibleColumns}
          rowKey={(e) => e.id}
          widths={widths}
          onWidthsChange={setWidths}
          sort={sort}
          onSortChange={setSort}
          onEditCell={handleEditCell}
          onOpenRow={(e) => router.push(`/etkinlikler/${e.id}`)}
          emptyState={
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <p className="text-sm text-muted-foreground">
                {events.length === 0 ? "Henüz etkinlik yok." : "Aramaya/filtreye uyan etkinlik yok."}
              </p>
              {events.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Filtreleri temizle
                </Button>
              )}
              {events.length === 0 && (
                <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> İlk etkinliği ekle
                </Button>
              )}
            </div>
          }
        />
      )}

      <div className="flex h-8 shrink-0 items-center border-t px-4 text-xs text-muted-foreground">
        {rows.length === events.length ? `${events.length} etkinlik` : `${rows.length} / ${events.length} etkinlik`}
      </div>

      <NewEventDialog open={newOpen} onOpenChange={setNewOpen} onCreated={() => queryClient.invalidateQueries({ queryKey: ["events"] })} />
    </div>
  );
}

function NewEventDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = React.useState({ name: "", date: "", location: "", capacity: "", description: "" });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm({ name: "", date: "", location: "", capacity: "", description: "" });
  }, [open]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Etkinlik adı gerekli");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/events", {
        name: form.name,
        date: form.date || undefined,
        location: form.location,
        description: form.description,
        capacity: form.capacity ? Number(form.capacity) : null,
      });
      toast.success("Etkinlik eklendi");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni etkinlik</DialogTitle>
          <DialogDescription>Temel bilgileri girin, detayları sonra düzenleyebilirsiniz.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Etkinlik adı</Label>
            <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="İstanbul Teknoloji Zirvesi 2027" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tarih</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Kapasite</Label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Yer</Label>
            <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Açıklama</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Ekleniyor…" : "Etkinliği ekle"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
