"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Plus, Search, Trash2, Users } from "lucide-react";
import { DataGrid, useColumnState, type GridColumn } from "@/components/data-grid/data-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/people/confirm-dialog";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client-api";
import { EVENT_STATUSES, PARTICIPANT_STATUSES } from "@/lib/constants";
import { avatarColor, formatDate, formatRelative, initials, personName } from "@/lib/utils";
import { sortRowsBy } from "@/lib/table-utils";
import type { CrmEvent, Person, SortState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ParticipantRow {
  personId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  status: string;
  registeredAt: string;
  lastConversationAt: string | null;
  lastConversationSubject: string | null;
}

export function EventDetailView({ eventId }: { eventId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortState>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => apiGet<{ event: CrmEvent; participants: ParticipantRow[] }>(`/api/events/${eventId}`),
  });
  const event = data?.event;
  const participants = data?.participants ?? [];

  const rows = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    let out = participants;
    if (q) {
      out = out.filter((p) => `${p.firstName} ${p.lastName} ${p.email} ${p.phone} ${p.company} ${p.city}`.toLocaleLowerCase("tr").includes(q));
    }
    if (statusFilter !== "all") out = out.filter((p) => p.status === statusFilter);
    return sortRowsBy(out, sort, (p, key) => {
      if (key === "firstName") return personName(p);
      const v = (p as unknown as Record<string, unknown>)[key];
      return v == null || v === "" ? null : String(v);
    });
  }, [participants, search, statusFilter, sort]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
  };

  const statusCounts = React.useMemo(() => {
    const c: Record<string, number> = { registered: 0, attended: 0, waitlist: 0, cancelled: 0 };
    for (const p of participants) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [participants]);

  const columns: GridColumn<ParticipantRow>[] = React.useMemo(
    () => [
      { key: "__index", label: "#", width: 46, sticky: true, align: "right", render: () => null },
      {
        key: "firstName",
        label: "Katılımcı",
        width: 210,
        sticky: true,
        render: (p) => (
          <Link
            href={`/kisiler?open=${p.personId}`}
            className="group/name flex min-w-0 items-center gap-2"
            title={`${personName(p)} — detayları aç (Shift+Enter)`}
          >
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white", avatarColor(p.email || p.personId))}>
              {initials(personName(p))}
            </span>
            <span className="truncate font-medium text-primary underline-offset-2 group-hover/name:underline">
              {personName(p)}
            </span>
            <ChevronRight className="h-3 w-3 shrink-0 text-primary/70 transition-opacity group-hover/name:opacity-100" />
          </Link>
        ),
        stringValue: (p) => personName(p),
      },
      {
        key: "email",
        label: "E-posta",
        width: 220,
        render: (p) => <span className="truncate text-primary">{p.email}</span>,
        stringValue: (p) => p.email,
      },
      {
        key: "phone",
        label: "Telefon",
        width: 140,
        render: (p) => <span className="truncate tabular-nums">{p.phone}</span>,
        stringValue: (p) => p.phone,
      },
      { key: "company", label: "Şirket", width: 170, render: (p) => <span className="truncate">{p.company}</span> },
      {
        key: "status",
        label: "Durum",
        width: 130,
        type: "select",
        editable: true,
        options: PARTICIPANT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
        render: (p) => (
          <Badge variant={p.status === "attended" ? "success" : p.status === "cancelled" ? "destructive" : "secondary"}>
            {PARTICIPANT_STATUSES.find((s) => s.value === p.status)?.label ?? p.status}
          </Badge>
        ),
        stringValue: (p) => PARTICIPANT_STATUSES.find((s) => s.value === p.status)?.label ?? p.status,
      },
      {
        key: "registeredAt",
        label: "Kayıt tarihi",
        width: 120,
        render: (p) => <span className="tabular-nums text-muted-foreground">{formatDate(p.registeredAt)}</span>,
        stringValue: (p) => formatDate(p.registeredAt),
      },
      {
        key: "lastConversationAt",
        label: "Son görüşme",
        width: 200,
        render: (p) => (
          <span className="truncate text-muted-foreground">
            {p.lastConversationAt ? `${formatRelative(p.lastConversationAt)} — ${p.lastConversationSubject ?? ""}` : "hiç yok"}
          </span>
        ),
        stringValue: (p) => (p.lastConversationAt ? formatRelative(p.lastConversationAt) : ""),
      },
      {
        key: "__remove",
        label: "",
        width: 48,
        render: () => null,
      },
    ],
    []
  );

  const { widths, setWidths, visibleColumns } = useColumnState("pronto:event-participants", columns);

  const handleEditCell = async (row: ParticipantRow, col: GridColumn<ParticipantRow>, value: string): Promise<boolean> => {
    if (col.key !== "status") return false;
    try {
      await apiPatch(`/api/events/${eventId}/participants/${row.personId}`, { status: value });
      invalidate();
      return true;
    } catch {
      toast.error("Durum güncellenemedi");
      return false;
    }
  };

  const removeParticipant = async (row: ParticipantRow) => {
    try {
      await apiDelete(`/api/events/${eventId}/participants/${row.personId}`);
      toast.success(`${personName(row)} etkinlikten çıkarıldı`);
      invalidate();
    } catch {
      toast.error("Çıkarılamadı");
    }
  };

  if (isLoading || !event) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Yükleniyor…</div>;
  }

  const columnsWithRemove: GridColumn<ParticipantRow>[] = visibleColumns.map((c) =>
    c.key === "__remove"
      ? {
          ...c,
          label: "",
          render: (p: ParticipantRow) => (
            <button
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                void removeParticipant(p);
              }}
              aria-label="Katılımcıyı çıkar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ),
        }
      : c
  );

  return (
    <div className="flex h-full flex-col">
      {/* başlık */}
      <div className="shrink-0 space-y-3 border-b px-5 py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/etkinlikler" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Etkinlikler
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{event.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatDate(event.date)} · {event.location || "yer belirtilmemiş"}
              {event.description ? ` — ${event.description}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Düzenle
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Users className="h-3.5 w-3.5" /> Katılımcı ekle
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Kayıtlı: {statusCounts.registered}</Badge>
          <Badge variant="success">Katıldı: {statusCounts.attended}</Badge>
          <Badge variant="warning">Yedek: {statusCounts.waitlist}</Badge>
          <Badge variant="destructive">İptal: {statusCounts.cancelled}</Badge>
          {event.capacity != null && (
            <Badge variant="muted">
              Kapasite: {participants.filter((p) => p.status !== "cancelled").length}/{event.capacity}
            </Badge>
          )}
        </div>
      </div>

      {/* filtre çubuğu */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-5 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Katılımcı ara…" className="h-8 w-56 pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {PARTICIPANT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
          >
            Temizle
          </Button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {rows.length === participants.length ? `${participants.length} katılımcı` : `${rows.length} / ${participants.length} katılımcı`}
        </span>
      </div>

      <DataGrid
        className="flex-1"
        rows={rows}
        columns={columnsWithRemove}
        rowKey={(p) => p.personId}
        widths={widths}
        onWidthsChange={setWidths}
        sort={sort}
        onSortChange={setSort}
        onEditCell={handleEditCell}
        onOpenRow={(p) => router.push(`/kisiler?open=${p.personId}`)}
        emptyState={
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <p className="text-sm text-muted-foreground">
              {participants.length === 0 ? "Bu etkinliğe henüz katılımcı eklenmemiş." : "Aramaya/filtreye uyan katılımcı yok."}
            </p>
            {participants.length === 0 ? (
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Katılımcı ekle
              </Button>
            ) : (
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
          </div>
        }
      />

      <div className="flex h-8 shrink-0 items-center border-t px-4 text-xs text-muted-foreground">
        {participants.length} katılımcı
      </div>

      <AddParticipantsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={eventId}
        existingIds={new Set(participants.map((p) => p.personId))}
        onAdded={invalidate}
      />
      <EditEventDialog open={editOpen} onOpenChange={setEditOpen} event={event} onSaved={invalidate} onDeleteOpen={() => setDeleteOpen(true)} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`"${event.name}" etkinliğini sil`}
        description="Katılımcı kayıtları da silinecek; kişi kayıtları korunur."
        confirmLabel="Sil"
        destructive
        onConfirm={async () => {
          await apiDelete(`/api/events/${eventId}`);
          toast.success("Etkinlik silindi");
          router.push("/etkinlikler");
        }}
      />
    </div>
  );
}

function EditEventDialog({
  open,
  onOpenChange,
  event,
  onSaved,
  onDeleteOpen,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: CrmEvent;
  onSaved: () => void;
  onDeleteOpen: () => void;
}) {
  const [form, setForm] = React.useState({
    name: event.name,
    date: event.date?.slice(0, 10) ?? "",
    location: event.location,
    description: event.description,
    capacity: event.capacity?.toString() ?? "",
    status: event.status,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm({
        name: event.name,
        date: event.date?.slice(0, 10) ?? "",
        location: event.location,
        description: event.description,
        capacity: event.capacity?.toString() ?? "",
        status: event.status,
      });
    }
  }, [open, event]);

  const save = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/events/${event.id}`, {
        name: form.name,
        date: form.date,
        location: form.location,
        description: form.description,
        capacity: form.capacity === "" ? null : Number(form.capacity),
        status: form.status,
      });
      toast.success("Etkinlik güncellendi");
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Etkinliği düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Ad</span>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Tarih</span>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Kapasite</span>
              <Input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Yer</span>
            <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Açıklama</span>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Durum</span>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CrmEvent["status"] }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {EVENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="mr-auto text-destructive hover:text-destructive" onClick={() => { onOpenChange(false); onDeleteOpen(); }}>
            <Trash2 className="h-3.5 w-3.5" /> Etkinliği sil
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddParticipantsDialog({
  open,
  onOpenChange,
  eventId,
  existingIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  existingIds: Set<string>;
  onAdded: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const { data } = useQuery({ queryKey: ["people"], queryFn: () => apiGet<{ people: Person[] }>("/api/people"), enabled: open });

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(new Set());
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? (data?.people ?? []).filter((p) => `${p.firstName} ${p.lastName} ${p.email} ${p.company}`.toLowerCase().includes(q))
      : data?.people ?? [];
    return list.slice(0, 60);
  }, [data, query]);

  const submit = async () => {
    if (!selected.size) return;
    setSaving(true);
    try {
      await apiPost(`/api/events/${eventId}/participants`, { personIds: [...selected] });
      toast.success(`${selected.size} katılımcı eklendi`);
      onOpenChange(false);
      onAdded();
    } catch {
      toast.error("Eklenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Katılımcı ekle</DialogTitle>
          <DialogDescription>Kişilerde ara, seçtiklerinizi etkinliğe kaydedin.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kişi ara…" className="pl-8" />
        </div>
        <div className="thin-scroll max-h-72 space-y-0.5 overflow-y-auto rounded-md border p-1">
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sonuç yok.</p>}
          {filtered.map((p) => {
            const already = existingIds.has(p.id);
            const checked = selected.has(p.id);
            return (
              <label
                key={p.id}
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted", already && "opacity-50")}
              >
                <Checkbox
                  checked={checked || already}
                  disabled={already}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(p.id);
                    else next.delete(p.id);
                    setSelected(next);
                  }}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{personName(p)}</span>
                  {p.company && <span className="text-muted-foreground"> · {p.company}</span>}
                </span>
                {already && <span className="text-[10px] text-muted-foreground">zaten kayıtlı</span>}
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <span className="mr-auto text-xs text-muted-foreground">{selected.size} seçildi</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving || selected.size === 0}>
            {saving ? "Ekleniyor…" : "Etkinliğe ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
