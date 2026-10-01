"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Mail, Trash2, Plus, MessageSquare, CalendarDays, FileClock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client-api";
import { avatarColor, formatDate, formatDateTime, formatPhone, initials, personName, parseTags, todayIso, formatRelative } from "@/lib/utils";import { convoHealth } from "./people-columns";
import { useLookups } from "@/components/lookups/use-lookups";
import type { AuditEntry, Conversation, CrmEvent, Person, User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PersonDetail {
  person: Person;
  conversations: Conversation[];
  events: Array<{ id: string; name: string; date: string; location: string; status: string; registeredAt: string }>;
  audit: AuditEntry[];
}

const DOT: Record<string, string> = {
  fresh: "bg-emerald-500",
  ok: "bg-amber-500",
  stale: "bg-rose-500",
  none: "bg-zinc-300 dark:bg-zinc-700",
};

export function PersonDrawer({
  personId,
  open,
  onOpenChange,
  onPersonChanged,
  onDelete,
}: {
  personId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPersonChanged: () => void;
  onDelete: (p: Person) => void;
}) {
  const { data } = useQuery({
    queryKey: ["person", personId],
    queryFn: () => apiGet<PersonDetail>(`/api/people/${personId}`),
    enabled: Boolean(personId) && open,
  });
  const users = useUsersList();
  const lookups = useLookups();

  const person = data?.person;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
        {person ? (
          <>
            <SheetHeader className="space-y-3">
              <div className="flex items-start gap-3 pr-8">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className={avatarColor(person.email || person.id)}>{initials(personName(person))}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{personName(person)}</SheetTitle>
                  <SheetDescription className="truncate">
                    {[person.title, person.company].filter(Boolean).join(" · ") || "—"}
                  </SheetDescription>
                </div>
              </div>
              {person.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {person.tags.map((t) => (
                    <Badge key={t} variant="accent">{t}</Badge>
                  ))}
                </div>
              )}
              {/* son görüşme özeti */}
              <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3 py-2.5">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[convoHealth(person.lastConversationAt)])} />
                {person.lastConversationAt ? (
                  <p className="text-sm">
                    <span className="font-medium">Son görüşme {formatRelative(person.lastConversationAt)}</span>
                    <span className="text-muted-foreground">
                      {" "}· {formatDate(person.lastConversationAt)}
                      {person.lastConversationSubject ? ` — ${person.lastConversationSubject}` : ""}
                      {person.lastConversationUser ? ` (${person.lastConversationUser})` : ""}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Bu kişiyle henüz görüşme kaydı yok.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild disabled={!person.phone}>
                  <a href={person.phone ? `tel:${person.phone}` : undefined}><Phone className="h-3.5 w-3.5" /> Ara</a>
                </Button>
                <Button variant="outline" size="sm" asChild disabled={!person.email}>
                  <a href={person.email ? `mailto:${person.email}` : undefined}><Mail className="h-3.5 w-3.5" /> E-posta</a>
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(person)}>
                  <Trash2 className="h-3.5 w-3.5" /> Sil
                </Button>
              </div>
            </SheetHeader>

            <Tabs key={person.id} defaultValue="conversations" className="flex min-h-0 flex-1 flex-col">
              <div className="border-b px-5 pb-2 pt-1">
                <TabsList>
                  <TabsTrigger value="conversations" className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Görüşmeler ({data?.conversations.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="info">Bilgiler</TabsTrigger>
                  <TabsTrigger value="events" className="gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> Etkinlikler
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-1.5">
                    <FileClock className="h-3.5 w-3.5" /> Geçmiş
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
                <TabsContent value="conversations" className="mt-0 p-5">
                  <ConversationsTab personId={person.id} conversations={data?.conversations ?? []} onChanged={onPersonChanged} />
                </TabsContent>
                <TabsContent value="info" className="mt-0 p-5">
                  <InfoTab person={person} users={users} lookups={lookups} onSaved={onPersonChanged} />
                </TabsContent>
                <TabsContent value="events" className="mt-0 p-5">
                  <EventsTab personId={person.id} events={data?.events ?? []} onChanged={onPersonChanged} />
                </TabsContent>
                <TabsContent value="history" className="mt-0 p-5">
                  <HistoryTab audit={data?.audit ?? []} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Yükleniyor…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function useUsersList(): User[] {
  const { data } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<{ users: User[] }>("/api/users"), staleTime: 60_000 });
  return data?.users ?? [];
}

// ---------- Görüşmeler ----------

function ConversationsTab({ personId, conversations, onChanged }: { personId: string; conversations: Conversation[]; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = React.useState(todayIso());
  const [subject, setSubject] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["person", personId] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
    onChanged();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error("Görüşme konusu gerekli");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/api/people/${personId}/conversations`, { date: new Date(date).toISOString(), subject, note });
      toast.success("Görüşme kaydedildi");
      setSubject("");
      setNote("");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiDelete(`/api/conversations/${id}`);
      toast.success("Görüşme silindi");
      invalidate();
    } catch {
      toast.error("Silinemedi");
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-2.5 rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">Yeni görüşme ekle</p>
        <div className="flex gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Konu (örn. fiyat teklifi gönderildi)" />
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not (isteğe bağlı)" rows={2} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !subject.trim()}>
            <Plus className="h-3.5 w-3.5" /> Kaydet
          </Button>
        </div>
      </form>

      {conversations.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Henüz görüşme yok. Yukarıdan ilk görüşmeyi ekleyin.</p>
      ) : (
        <ol className="relative space-y-4 border-l pl-4">
          {conversations.map((c) => (
            <li key={c.id} className="group relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-primary" />
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{c.subject || "(konusuz)"}</p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDateTime(c.date)}</span>
              </div>
              {c.note && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{c.note}</p>}
              <p className="mt-1 text-xs text-muted-foreground/80">{c.userName ?? "Bilinmeyen kullanıcı"} tarafından</p>
              <button
                className="absolute -right-1 top-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive group-hover:opacity-100"
                onClick={() => remove(c.id)}
                aria-label="Görüşmeyi sil"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------- Bilgiler ----------

function InfoTab({
  person,
  users,
  lookups,
  onSaved,
}: {
  person: Person;
  users: User[];
  lookups: { title: Array<{ value: string }>; city: Array<{ value: string }>; source: Array<{ value: string }> };
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState({
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone,
    company: person.company,
    title: person.title,
    city: person.city,
    source: person.source,
    tagsText: person.tags.join(", "),
    ownerId: person.ownerId ?? "none",
    notes: person.notes,
  });
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify({
    firstName: person.firstName, lastName: person.lastName, email: person.email, phone: person.phone,
    company: person.company, title: person.title, city: person.city, source: person.source,
    tagsText: person.tags.join(", "), ownerId: person.ownerId ?? "none", notes: person.notes,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/people/${person.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        company: form.company,
        title: form.title,
        city: form.city,
        source: form.source,
        tags: parseTags(form.tagsText),
        ownerId: form.ownerId === "none" ? null : form.ownerId,
        notes: form.notes,
      });
      toast.success("Bilgiler kaydedildi");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Ad</Label>
          <Input value={form.firstName} onChange={set("firstName")} />
        </div>
        <div className="space-y-1.5">
          <Label>Soyad</Label>
          <Input value={form.lastName} onChange={set("lastName")} />
        </div>
        <div className="space-y-1.5">
          <Label>E-posta</Label>
          <Input type="email" value={form.email} onChange={set("email")} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={set("phone")} placeholder="+90…" />
        </div>
        <div className="space-y-1.5">
          <Label>Şirket</Label>
          <Input value={form.company} onChange={set("company")} />
        </div>
        <div className="space-y-1.5">
          <Label>Ünvan</Label>
          <LookupSelect
            value={form.title}
            options={lookupOptions(lookups.title, form.title)}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Şehir</Label>
          <LookupSelect
            value={form.city}
            options={lookupOptions(lookups.city, form.city)}
            onChange={(v) => setForm((f) => ({ ...f, city: v }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kaynak</Label>
          <LookupSelect
            value={form.source}
            options={lookupOptions(lookups.source, form.source)}
            onChange={(v) => setForm((f) => ({ ...f, source: v }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Etiketler</Label>
          <Input value={form.tagsText} onChange={set("tagsText")} placeholder="VIP, Kurumsal" />
        </div>
        <div className="space-y-1.5">
          <Label>Sorumlu</Label>
          <Select value={form.ownerId} onValueChange={(v) => setForm((f) => ({ ...f, ownerId: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— atanmadı —</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Notlar</Label>
        <Textarea value={form.notes} onChange={set("notes")} rows={3} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Eklenme: {formatDate(person.createdAt)}</p>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? "Kaydediliyor…" : dirty ? "Değişiklikleri kaydet" : "Kaydedildi"}
        </Button>
      </div>
    </div>
  );
}

/** lookup alanları için combobox: listeden seçim; mevcut değer listede yoksa korunur */
function lookupOptions(list: Array<{ value: string }>, current: string): Array<{ value: string; label: string }> {
  const opts = list.map((l) => ({ value: l.value, label: l.value }));
  if (current && !opts.some((o) => o.value === current)) {
    return [{ value: current, label: `${current} (listede yok)` }, ...opts];
  }
  return opts;
}

function LookupSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value || "__bos"} onValueChange={(v) => onChange(v === "__bos" ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Seçin…" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="__bos">— (boş)</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------- Etkinlikler ----------

function EventsTab({ personId, events, onChanged }: { personId: string; events: Array<{ id: string; name: string; date: string; location: string; status: string; registeredAt: string }>; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const { data: eventsData } = useQuery({ queryKey: ["events"], queryFn: () => apiGet<{ events: CrmEvent[] }>("/api/events") });
  const [addId, setAddId] = React.useState("");

  const allEvents = eventsData?.events ?? [];
  const joinedIds = new Set(events.map((e) => e.id));
  const available = allEvents.filter((e) => !joinedIds.has(e.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["person", personId] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
    onChanged();
  };

  const add = async () => {
    if (!addId) return;
    try {
      await apiPost(`/api/events/${addId}/participants`, { personIds: [personId] });
      toast.success("Etkinliğe eklendi");
      setAddId("");
      invalidate();
    } catch {
      toast.error("Eklenemedi");
    }
  };

  const setStatus = async (eventId: string, status: string) => {
    try {
      await apiPatch(`/api/events/${eventId}/participants/${personId}`, { status });
      invalidate();
    } catch {
      toast.error("Güncellenemedi");
    }
  };

  const remove = async (eventId: string) => {
    try {
      await apiDelete(`/api/events/${eventId}/participants/${personId}`);
      toast.success("Etkinlikten çıkarıldı");
      invalidate();
    } catch {
      toast.error("Çıkarılamadı");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={addId} onValueChange={setAddId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Etkinlik seç…" />
          </SelectTrigger>
          <SelectContent>
            {available.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} ({formatDate(e.date)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={add} disabled={!addId}>
          <Plus className="h-3.5 w-3.5" /> Ekle
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Bu kişi hiçbir etkinliğe kayıtlı değil.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-lg border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(e.date)} · {e.location || "yer belirtilmemiş"} · kayıt: {formatDate(e.registeredAt)}
                </p>
              </div>
              <select
                value={e.status}
                onChange={(ev) => setStatus(e.id, ev.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="registered">Kayıtlı</option>
                <option value="attended">Katıldı</option>
                <option value="waitlist">Yedek</option>
                <option value="cancelled">İptal</option>
              </select>
              <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id)} aria-label="Çıkar">
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Geçmiş ----------

const ACTION_LABELS: Record<string, string> = {
  create: "oluşturuldu",
  update: "güncellendi",
  delete: "silindi",
  login: "giriş yaptı",
};

function HistoryTab({ audit }: { audit: AuditEntry[] }) {
  if (audit.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Değişiklik geçmişi yok.</p>;
  }
  return (
    <ol className="space-y-2.5">
      {audit.map((a) => (
        <li key={a.id} className="rounded-lg border p-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <p>
              <span className="font-medium">{a.userName ?? "Sistem"}</span>{" "}
              <span className="text-muted-foreground">
                {a.entity === "conversation" ? "görüşme" : "kişiyi"} {ACTION_LABELS[a.action] ?? a.action}
              </span>
              {a.summary && <span className="text-muted-foreground"> — {a.summary}</span>}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
          </div>
          {a.changes && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(a.changes).map(([field, [oldV, newV]]) => (
                <span key={field} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {field}: “{String(oldV ?? "")}” → “{String(newV ?? "")}”
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
