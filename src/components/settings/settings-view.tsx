"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound, Webhook as WebhookIcon, Plus, Copy, Trash2, Download, UploadCloud, RefreshCw, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/people/confirm-dialog";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/client-api";
import { WEBHOOK_EVENTS } from "@/lib/constants";
import { formatRelative, formatDateTime } from "@/lib/utils";
import { useUser } from "@/components/user-context";
import type { ApiKey, User, Webhook, WebhookDelivery } from "@/lib/types";

export function SettingsView() {
  const user = useUser();
  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto thin-scroll p-6">
      <Tabs defaultValue="general">
        <TabsList className="mb-5">
          <TabsTrigger value="general">Genel</TabsTrigger>
          {user.role === "admin" && <TabsTrigger value="users">Kullanıcılar</TabsTrigger>}
          <TabsTrigger value="api">API Entegrasyonları</TabsTrigger>
          <TabsTrigger value="backup">Yedekleme</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-0"><GeneralTab /></TabsContent>
        {user.role === "admin" && <TabsContent value="users" className="mt-0"><UsersTab /></TabsContent>}
        <TabsContent value="api" className="mt-0 space-y-8"><ApiTab /></TabsContent>
        <TabsContent value="backup" className="mt-0"><BackupTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Genel ----------

function GeneralTab() {
  const user = useUser();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<{ orgName: string }>("/api/settings") });

  React.useEffect(() => {
    if (data) setOrgName(data.orgName);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await apiPut("/api/settings", { orgName });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Kaydedildi. Kenar çubuğunda güncellenecek.");
    } catch {
      toast.error("Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const resetDemo = async () => {
    try {
      await apiPost("/api/settings/reset-demo");
      queryClient.invalidateQueries();
      toast.success("Demo verisi sıfırlandı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sıfırlanamadı");
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Kurum adı</Label>
          <p className="text-xs text-muted-foreground">Kenar çubuğunda ve raporlarda görünür.</p>
          <div className="flex max-w-sm gap-2">
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <Button onClick={save} disabled={saving || !orgName.trim()}>{saving ? "…" : "Kaydet"}</Button>
          </div>
        </div>
      </div>

      {user.role === "admin" && (
        <div className="rounded-lg border border-destructive/30 p-4">
          <p className="text-sm font-medium text-destructive">Demo verisini sıfırla</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tüm kişiler, görüşmeler, etkinlikler ve ayarlar silinip 200 kişilik örnek veri yeniden üretilir.
          </p>
          <Button variant="destructive" size="sm" className="mt-3" onClick={() => setResetOpen(true)}>
            <RefreshCw className="h-3.5 w-3.5" /> Sıfırla
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Demo verisi sıfırlanacak"
        description="Bu işlem geri alınamaz. Yedek almak isterseniz önce Yedekleme sekmesini kullanın."
        confirmLabel="Evet, sıfırla"
        destructive
        onConfirm={resetDemo}
      />
    </div>
  );
}

// ---------- Kullanıcılar ----------

function UsersTab() {
  const queryClient = useQueryClient();
  const currentUser = useUser();
  const [addOpen, setAddOpen] = React.useState(false);
  const { data } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<{ users: User[] }>("/api/users") });
  const users = data?.users ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      await apiPatch(`/api/users/${id}`, body);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
      invalidate();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Ekip üyeleri kayıtlara erişebilir ve düzenleyebilir.</p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Kullanıcı ekle
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Kullanıcı</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Durum</th>
              <th className="px-4 py-2 font-medium">Eklenme</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                    disabled={u.id === currentUser.id}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"
                  >
                    <option value="admin">Yönetici</option>
                    <option value="member">Ekip üyesi</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Switch checked={u.active} onCheckedChange={(v) => patch(u.id, { active: v })} disabled={u.id === currentUser.id} />
                    <span className="text-xs text-muted-foreground">{u.active ? "Aktif" : "Devre dışı"}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatRelative(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onCreated={invalidate} />
    </div>
  );
}

function AddUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = React.useState({ name: "", email: "", password: "", role: "member" });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm({ name: "", email: "", password: "", role: "member" });
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      await apiPost("/api/users", form);
      toast.success("Kullanıcı eklendi");
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kullanıcı ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ad Soyad</Label>
            <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>E-posta</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Şifre</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="en az 6 karakter" />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="member">Ekip üyesi</option>
              <option value="admin">Yönetici</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Ekleniyor…" : "Ekle"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- API ----------

function ApiTab() {
  return (
    <>
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="h-4 w-4 text-primary" /> Veri al (Inbound)
          </h2>
          <p className="text-sm text-muted-foreground">
            Form araçlarınız ve scriptleriniz bu anahtarla kişi ekleyebilir. Anahtarlar sadece oluşturulduklarında bir kez gösterilir.
          </p>
        </div>
        <InboundKeys />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <WebhookIcon className="h-4 w-4 text-primary" /> Veri gönder (Outbound)
          </h2>
          <p className="text-sm text-muted-foreground">
            Kişi eklendiğinde, güncellendiğinde veya görüşme kaydedildiğinde seçtiğiniz adreslere imzalı bildirim gönderilir.
          </p>
        </div>
        <OutboundWebhooks />
      </section>
    </>
  );
}

function InboundKeys() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["keys"], queryFn: () => apiGet<{ keys: ApiKey[] }>("/api/keys") });
  const keys = data?.keys ?? [];
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => setOrigin(window.location.origin), []);

  const create = async () => {
    try {
      const res = await apiPost<{ key: string }>("/api/keys", { name: newName });
      setCreatedKey(res.key);
      queryClient.invalidateQueries({ queryKey: ["keys"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Anahtar oluşturulamadı");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setNewName(""); setCreatedKey(null); setNewOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Yeni anahtar
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Anahtar</th>
              <th className="px-4 py-2 font-medium">Son kullanım</th>
              <th className="px-4 py-2 font-medium">Durum</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Henüz anahtar yok.</td></tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-t">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{k.prefix}…</p>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{k.lastUsedAt ? formatRelative(k.lastUsedAt) : "hiç"}</td>
                <td className="px-4 py-2.5">
                  <Switch defaultChecked={k.active} onCheckedChange={(v) => apiPatch(`/api/keys/${k.id}`, { active: v }).then(() => queryClient.invalidateQueries({ queryKey: ["keys"] }))} />
                </td>
                <td className="px-2 py-2.5">
                  <DeleteButton onDelete={() => apiDelete(`/api/keys/${k.id}`).then(() => { toast.success("Anahtar silindi"); queryClient.invalidateQueries({ queryKey: ["keys"] }); })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-xs">
        <p className="font-medium">Kullanım</p>
        <pre className="thin-scroll mt-2 overflow-x-auto rounded bg-background p-3 font-mono text-[11px] leading-relaxed">{`curl -X POST ${origin}/api/v1/people \\
  -H "Authorization: Bearer <ANAHTAR>" \\
  -H "Content-Type: application/json" \\
  -d '{"firstName":"Zeynep","lastName":"Kaya","email":"zeynep@ornek.com","phone":"+905321112233"}'`}</pre>
        <p className="mt-2 text-muted-foreground">Toplu eklemek için gövdeyi şu biçimde gönderin: {'{"people":[{…},{…}]}'}</p>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createdKey ? "Anahtarınız hazır" : "Yeni API anahtarı"}</DialogTitle>
            <DialogDescription>{createdKey ? "Bu anahtarı şimdi kopyalayın; sonra bir daha gösterilmeyecek." : "Anahtara bir ad verin (örn. 'Kayıt formu')."}</DialogDescription>
          </DialogHeader>
          {createdKey ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
              <code className="flex-1 break-all font-mono text-xs">{createdKey}</code>
              <Button variant="outline" size="icon-sm" onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("Kopyalandı"); }}>
                <Copy />
              </Button>
            </div>
          ) : (
            <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Anahtar adı" />
          )}
          <DialogFooter>
            {createdKey ? (
              <Button onClick={() => setNewOpen(false)}>Tamam</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setNewOpen(false)}>Vazgeç</Button>
                <Button onClick={create}>Oluştur</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-destructive"
      onClick={() => {
        if (window.confirm("Emin misiniz?")) onDelete();
      }}
      aria-label="Sil"
    >
      <Trash2 />
    </Button>
  );
}

function OutboundWebhooks() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Webhook | null>(null);
  const { data } = useQuery({ queryKey: ["webhooks"], queryFn: () => apiGet<{ webhooks: Webhook[] }>("/api/webhooks") });
  const { data: deliveriesData } = useQuery({ queryKey: ["deliveries"], queryFn: () => apiGet<{ deliveries: WebhookDelivery[] }>("/api/webhooks/deliveries"), refetchInterval: 15000 });
  const webhooks = data?.webhooks ?? [];
  const deliveries = deliveriesData?.deliveries ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    queryClient.invalidateQueries({ queryKey: ["deliveries"] });
  };

  const test = async (w: Webhook) => {
    toast.info("Test gönderiliyor…");
    try {
      const res = await apiPost<{ ok: boolean; status: number | null; error: string | null }>(`/api/webhooks/${w.id}/test`);
      if (res.ok) toast.success(`Test başarılı (${res.status})`);
      else toast.error(`Test başarısız${res.status ? ` (${res.status})` : ""}${res.error ? `: ${res.error}` : ""}`);
      invalidate();
    } catch {
      toast.error("Test gönderilemedi");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setEditOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Yeni webhook
        </Button>
      </div>
      <div className="space-y-2">
        {webhooks.length === 0 && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Henüz webhook yok.</p>}
        {webhooks.map((w) => (
          <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{w.name}</p>
                <Switch checked={w.active} onCheckedChange={(v) => apiPatch(`/api/webhooks/${w.id}`, { active: v }).then(invalidate)} />
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">{w.url}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {w.events.map((e) => (
                  <Badge key={e} variant="muted" className="text-[10px]">{WEBHOOK_EVENTS.find((x) => x.value === e)?.label ?? e}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => test(w)}>Test et</Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(w); setEditOpen(true); }}>Düzenle</Button>
              <DeleteButton onDelete={() => apiDelete(`/api/webhooks/${w.id}`).then(() => { toast.success("Silindi"); invalidate(); })} />
            </div>
          </div>
        ))}
      </div>

      {deliveries.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Son gönderimler</p>
          <ul className="divide-y rounded-lg border text-xs">
            {deliveries.slice(0, 10).map((d) => (
              <li key={d.id} className="flex items-center gap-2 px-3 py-2">
                {d.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                <span className="font-medium">{d.event}</span>
                <span className="text-muted-foreground">{d.status ?? "—"} · {formatDateTime(d.createdAt)}</span>
                {d.error && <span className="truncate text-destructive">{d.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <WebhookDialog open={editOpen} onOpenChange={setEditOpen} webhook={editing} onSaved={invalidate} />
    </div>
  );
}

function WebhookDialog({ open, onOpenChange, webhook, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; webhook: Webhook | null; onSaved: () => void }) {
  const [form, setForm] = React.useState({ name: "", url: "", secret: "", events: ["person.created"] as string[] });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm({
        name: webhook?.name ?? "",
        url: webhook?.url ?? "",
        secret: webhook?.secret ?? crypto.randomUUID().replace(/-/g, ""),
        events: webhook?.events ?? ["person.created"],
      });
    }
  }, [open, webhook]);

  const toggleEvent = (e: string) => {
    setForm((f) => ({ ...f, events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e] }));
  };

  const save = async () => {
    if (!form.url.trim()) {
      toast.error("Webhook adresi gerekli");
      return;
    }
    setSaving(true);
    try {
      if (webhook) await apiPatch(`/api/webhooks/${webhook.id}`, form);
      else await apiPost("/api/webhooks", form);
      toast.success(webhook ? "Güncellendi" : "Webhook eklendi");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{webhook ? "Webhook'u düzenle" : "Yeni webhook"}</DialogTitle>
          <DialogDescription>Bildirim gövdesi HMAC-SHA256 imzasıyla gönderilir (X-Pronto-Signature başlığı).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ad</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Slack köprüsü" />
          </div>
          <div className="space-y-1.5">
            <Label>Adres</Label>
            <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>İmza gizli anahtarı</Label>
            <div className="flex gap-2">
              <Input value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => setForm((f) => ({ ...f, secret: crypto.randomUUID().replace(/-/g, "") }))} aria-label="Yenile">
                <RefreshCw />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Hangi olaylar gönderilsin?</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {form.events.length} olay seçili
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Olaylar</DropdownMenuLabel>
                {WEBHOOK_EVENTS.map((e) => (
                  <DropdownMenuCheckboxItem key={e.value} checked={form.events.includes(e.value)} onCheckedChange={() => toggleEvent(e.value)} onSelect={(ev) => ev.preventDefault()}>
                    {e.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Yedekleme ----------

function BackupTab() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [autoBackup, setAutoBackup] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<{ autoBackup?: string }>("/api/settings") });

  React.useEffect(() => {
    if (data) setAutoBackup(data.autoBackup === "on");
  }, [data]);

  const setAuto = async (v: boolean) => {
    setAutoBackup(v);
    await apiPut("/api/settings", { autoBackup: v ? "on" : "off" }).catch(() => {});
  };

  const restore = async (file: File) => {
    setRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await apiPost("/api/restore", data);
      toast.success("Yedek geri yüklendi. Sayfalar yenileniyor…");
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Geri yükleme başarısız");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">Dışa aktar</h3>
        <p className="mt-1 text-xs text-muted-foreground">Tüm veriyi JSON olarak veya kişi listesini CSV olarak indirin.</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" asChild>
            <a href="/api/export?scope=all&format=json"><Download className="h-3.5 w-3.5" /> Tam yedek (JSON)</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export?scope=people&format=csv"><Download className="h-3.5 w-3.5" /> Kişiler (CSV)</a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium">Geri yükle</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Bir Pronto CRM yedeği yükleyin. Mevcut verilerin yerine geçer — yalnızca yöneticiler kullanabilir.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && window.confirm("Mevcut veriler silinecek ve yedekteki veriler yüklenecek. Devam edilsin mi?")) restore(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" className="mt-3" onClick={() => fileRef.current?.click()} disabled={restoring}>
          {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
          {restoring ? "Geri yükleniyor…" : "Yedek dosyası seç"}
        </Button>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Otomatik yedek</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Bu sürümde sunucu tarafı zamanlanmış yedek simüle edilir; yine de düzenli tam yedek indirmeniz önerilir.
            </p>
          </div>
          <Switch checked={autoBackup} onCheckedChange={setAuto} />
        </div>
      </div>
    </div>
  );
}
