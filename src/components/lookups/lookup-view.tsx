"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListTree, Plus, Pencil, Trash2, Search, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/people/confirm-dialog";
import { useLookups, type LookupItem, type LookupType } from "./use-lookups";
import { apiDelete, apiPatch, apiPost } from "@/lib/client-api";

const TABS: Array<{ type: LookupType; label: string; hint: string }> = [
  { type: "title", label: "Ünvanlar", hint: "Kişilerin ünvan alanında önerilir." },
  { type: "city", label: "Şehirler", hint: "Türkiye'nin 81 ili tanımlı; dilediğinizi ekleyip çıkarabilirsiniz." },
  { type: "source", label: "Kaynaklar", hint: "Kişilerin kaynak alanında önerilir." },
];

export function LookupView() {
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto thin-scroll p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <ListTree className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-base font-semibold tracking-tight">Liste Seçenekleri</h1>
          <p className="text-sm text-muted-foreground">
            Formlarda ve ızgarada öneri olarak çıkar; mevcut kişi kayıtlarını değiştirmeden yönetilir.
          </p>
        </div>
      </div>

      <Tabs defaultValue="title">
        <TabsList className="mb-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.type} value={t.type}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.type} value={t.type} className="mt-0">
            <LookupListTab type={t.type} hint={t.hint} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function LookupListTab({ type, hint }: { type: LookupType; hint: string }) {
  const queryClient = useQueryClient();
  const lookups = useLookups();
  const items = lookups[type];
  const [search, setSearch] = React.useState("");
  const [newValue, setNewValue] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<LookupItem | null>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return items;
    return items.filter((i) => i.value.toLocaleLowerCase("tr").includes(q));
  }, [items, search]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["lookups"] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
  };

  const add = async () => {
    if (!newValue.trim()) return;
    setAdding(true);
    try {
      const res = await apiPost<{ existed?: boolean }>("/api/lookups", { type, value: newValue });
      toast.success(res.existed ? "Bu değer zaten listede" : "Eklendi");
      setNewValue("");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Listede ara…" className="h-8 w-56 pl-8 text-sm" />
        </div>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{items.length} kayıt</span>
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder="Yeni değer…"
          className="h-8 flex-1"
        />
        <Button size="sm" onClick={add} disabled={adding || !newValue.trim()}>
          <Plus className="h-3.5 w-3.5" /> Ekle
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Değer</th>
              <th className="px-4 py-2 font-medium">Kullanım</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? "Aramaya uyan kayıt yok." : "Liste boş."}
                </td>
              </tr>
            )}
            {filtered.map((item) => (
              <tr key={item.id} className="group border-t">
                <td className="px-4 py-1.5">
                  <EditableValue id={item.id} value={item.value} onSaved={invalidate} />
                </td>
                <td className="px-4 py-1.5">
                  {item.usage > 0 ? (
                    <Badge variant="muted">{item.usage} kişi</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(item)}
                      aria-label="Sil"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`"${deleteTarget?.value ?? ""}" silinsin mi?`}
        description={
          deleteTarget && deleteTarget.usage > 0
            ? `Bu değer ${deleteTarget.usage} kişi kaydında geçiyor. Kişi kayıtları değişmez; yalnızca öneri listesinden çıkar.`
            : "Bu değer öneri listesinden kaldırılır."
        }
        confirmLabel="Sil"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await apiDelete(`/api/lookups/${deleteTarget.id}`);
            toast.success("Silindi");
            invalidate();
          } catch {
            toast.error("Silinemedi");
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function EditableValue({ id, value, onSaved }: { id: string; value: string; onSaved: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, value]);

  const save = async () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === value) return;
    try {
      await apiPatch(`/api/lookups/${id}`, { value: next });
      toast.success("Güncellendi. Bu değeri kullanan kişi kayıtları da eşitlendi.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 text-sm"
        />
        <Button variant="ghost" size="icon-sm" onClick={save} aria-label="Kaydet">
          <Check />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(false)} aria-label="Vazgeç">
          <X />
        </Button>
      </div>
    );
  }

  return (
    <button
      className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-muted"
      onClick={() => setEditing(true)}
      title="Düzenlemek için tıklayın"
    >
      <span className="truncate">{value}</span>
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
