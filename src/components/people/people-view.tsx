"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Filter, Columns3, Rows3, Plus, Upload, Bookmark, BookmarkPlus, Trash2, X, Undo2, UserCheck, Tags,
} from "lucide-react";
import { DataGrid, useColumnState, type GridDensity, type GridColumn, type CellEdit } from "@/components/data-grid/data-grid";
import { buildPeopleColumns } from "./people-columns";
import { applyPeopleFilters, loadSavedViews, saveSavedViews, DEFAULT_VIEW_STATE, type PeopleViewState, type SavedView } from "./people-filter";
import { PersonDrawer } from "./person-drawer";
import { NewPersonDialog } from "./new-person-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { useLookups } from "@/components/lookups/use-lookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiGet, apiPost } from "@/lib/client-api";
import { FILTER_FIELDS, FILTER_OPS, QUICK_VIEWS } from "@/lib/constants";
import { isValidEmail, normalizePhone, parseTags, personName } from "@/lib/utils";
import type { FilterOp, Person, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const DENSITIES: { value: GridDensity; label: string }[] = [
  { value: "compact", label: "Sıkı" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Rahat" },
];

export function PeopleView({ initialOpenId, initialNew }: { initialOpenId?: string; initialNew?: boolean }) {
  const queryClient = useQueryClient();
  const [state, setState] = React.useState<PeopleViewState>(DEFAULT_VIEW_STATE);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [density, setDensity] = React.useState<GridDensity>("normal");
  const [openId, setOpenId] = React.useState<string | null>(initialOpenId ?? null);
  const [newOpen, setNewOpen] = React.useState(Boolean(initialNew));
  const [deleteTarget, setDeleteTarget] = React.useState<Person | "bulk" | null>(null);
  const [savedViews, setSavedViews] = React.useState<SavedView[]>([]);
  const undoStack = React.useRef<(() => void)[]>([]);

  React.useEffect(() => setSavedViews(loadSavedViews()), []);

  const { data, isLoading } = useQuery({ queryKey: ["people"], queryFn: () => apiGet<{ people: Person[] }>("/api/people") });
  const { data: usersData } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<{ users: User[] }>("/api/users") });
  const lookups = useLookups();
  const users = usersData?.users ?? [];
  const people = data?.people ?? [];
  const allPeople = people;
  const rows = React.useMemo(() => applyPeopleFilters(people, state), [people, state]);

  const columns: GridColumn<Person>[] = React.useMemo(
    () =>
      buildPeopleColumns({
        users: users.map((u) => ({ id: u.id, name: u.name })),
        onOpen: (p) => setOpenId(p.id),
        onAction: () => {},
        density,
        lookups: {
          title: lookups.title.map((l) => l.value),
          city: lookups.city.map((l) => l.value),
          source: lookups.source.map((l) => l.value),
        },
      }),
    [users, density, lookups]
  );
  const { widths, setWidths, hiddenKeys, toggleHidden, visibleColumns } = useColumnState("pronto:people", columns);

  // ---------- veri işlemleri ----------

  const patchPerson = React.useCallback(
    (id: string, patch: Partial<Person>) => {
      queryClient.setQueryData<{ people: Person[] }>(["people"], (old) =>
        old ? { ...old, people: old.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : old
      );
    },
    [queryClient]
  );

  const normalizeField = (field: string) => (field === "ownerName" ? "ownerId" : field);

  const currentValue = (p: Person, field: string): string => {
    if (field === "ownerId") return p.ownerId ?? "";
    if (field === "tags") return p.tags.join(", ");
    const v = (p as unknown as Record<string, unknown>)[field];
    return v == null ? "" : String(v);
  };

  const applyEdits = React.useCallback(
    async (edits: CellEdit[]) => {
      if (!edits.length) return;

      // eski değerleri yakala (undo için)
      const prevEdits: CellEdit[] = [];
      for (const e of edits) {
        const p = allPeople.find((x) => x.id === e.id);
        if (p) prevEdits.push({ id: e.id, field: e.field, value: currentValue(p, e.field) });
      }

      // iyimser güncelleme
      for (const e of edits) {
        if (e.field === "ownerId") {
          patchPerson(e.id, { ownerId: e.value || null, ownerName: users.find((u) => u.id === e.value)?.name ?? null });
        } else if (e.field === "tags") {
          patchPerson(e.id, { tags: parseTags(e.value) });
        } else {
          patchPerson(e.id, { [e.field]: e.value } as Partial<Person>);
        }
      }

      try {
        await apiPost("/api/people/bulk", {
          op: "edit",
          edits: edits.map((e) => ({ id: e.id, field: normalizeField(e.field), value: e.value })),
        });
        const undo = () => void applyEdits(prevEdits);
        undoStack.current.push(undo);
        if (undoStack.current.length > 25) undoStack.current.shift();
        toast.success(edits.length === 1 ? "Kayıt güncellendi" : `${edits.length} hücre güncellendi`, {
          action: { label: "Geri al", onClick: undo },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Güncelleme başarısız");
        queryClient.invalidateQueries({ queryKey: ["people"] });
      }
    },
    [allPeople, people, patchPerson, queryClient, users]
  );

  const handleEditCell = async (row: Person, col: GridColumn<Person>, value: string): Promise<boolean> => {
    const field = normalizeField(col.key);
    if (field === "email" && value.trim() && !isValidEmail(value)) {
      toast.error("Geçerli bir e-posta adresi girin");
      return false;
    }
    const normalized = field === "phone" ? normalizePhone(value) : value;
    await applyEdits([{ id: row.id, field, value: normalized }]);
    return true;
  };

  const handleEditCells = async (edits: CellEdit[]) => {
    const mapped = edits
      .map((e) => {
        const field = normalizeField(e.field);
        const value = field === "phone" ? normalizePhone(e.value) : e.value;
        if (field === "email" && value && !isValidEmail(value)) return null;
        return { id: e.id, field, value };
      })
      .filter(Boolean) as CellEdit[];
    await applyEdits(mapped);
  };

  const handleCreateRows = async (newRows: Record<string, string>[]) => {
    try {
      const res = await apiPost<{ people: Person[] }>("/api/people", { people: newRows });
      queryClient.setQueryData<{ people: Person[] }>(["people"], (old) => (old ? { ...old, people: [...res.people, ...old.people] } : old));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kişiler eklenemedi");
    }
  };

  const handleUndo = () => {
    const undo = undoStack.current.pop();
    if (undo) undo();
    else toast.info("Geri alınacak işlem yok");
  };

  const bulkAction = async (body: Record<string, unknown>, message: string) => {
    try {
      await apiPost("/api/people/bulk", body);
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success(message);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    }
  };

  const handleDelete = async () => {
    if (deleteTarget === "bulk") {
      await bulkAction({ op: "delete", ids: [...selectedIds] }, `${selectedIds.size} kişi silindi`);
    } else if (deleteTarget) {
      try {
        await fetch(`/api/people/${deleteTarget.id}`, { method: "DELETE" });
        queryClient.invalidateQueries({ queryKey: ["people"] });
        toast.success(`${personName(deleteTarget)} silindi`);
        setOpenId((cur) => (cur === deleteTarget.id ? null : cur));
      } catch {
        toast.error("Silme başarısız");
      }
    }
    setDeleteTarget(null);
  };

  // ---------- görünüm yardımcıları ----------

  const activeQuickView = QUICK_VIEWS.find((q) => q.id === state.quickView);
  const filtersActive = state.rules.length > 0 || state.quickView !== "all" || state.search !== "";

  const saveCurrentView = () => {
    const name = window.prompt("Görünüm adı:", `Görünüm ${savedViews.length + 1}`);
    if (!name) return;
    const view: SavedView = { id: crypto.randomUUID(), name, state: { rules: state.rules, quickView: state.quickView, sort: state.sort } };
    const next = [...savedViews, view];
    setSavedViews(next);
    saveSavedViews(next);
    toast.success(`"${name}" görünümü kaydedildi`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* araç çubuğu */}
      <div className="shrink-0 space-y-2 border-b bg-background px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={state.search}
            onChange={(e) => setState((s) => ({ ...s, search: e.target.value }))}
            placeholder="Ad, e-posta, telefon, şirket…"
            className="h-8 w-64"
          />

          {/* görünümler */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Bookmark className="h-3.5 w-3.5" />
                {activeQuickView?.label ?? "Görünümler"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Hızlı görünümler</DropdownMenuLabel>
              {QUICK_VIEWS.map((q) => (
                <DropdownMenuItem key={q.id} onClick={() => setState((s) => ({ ...s, quickView: q.id }))}>
                  <span className={cn("flex-1", state.quickView === q.id && "font-medium text-primary")}>{q.label}</span>
                  {state.quickView === q.id && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
              {savedViews.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Kayıtlı görünümler</DropdownMenuLabel>
                  {savedViews.map((v) => (
                    <DropdownMenuItem key={v.id} onClick={() => setState((s) => ({ ...s, ...v.state }))}>
                      <span className="flex-1">{v.name}</span>
                      <button
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 [&[data-open]]:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = savedViews.filter((x) => x.id !== v.id);
                          setSavedViews(next);
                          saveSavedViews(next);
                        }}
                        aria-label="Görünümü sil"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={saveCurrentView}>
                <BookmarkPlus /> Geçerli görünümü kaydet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* filtreler */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filtre
                {state.rules.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{state.rules.length}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[420px] p-3">
              <FilterEditor
                rules={state.rules}
                onChange={(rules) => setState((s) => ({ ...s, rules }))}
              />
            </PopoverContent>
          </Popover>

          {/* sütunlar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Columns3 className="h-3.5 w-3.5" />
                Sütunlar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
              <DropdownMenuLabel>Gösterilecek sütunlar</DropdownMenuLabel>
              {columns
                .filter((c) => !c.key.startsWith("__"))
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={!hiddenKeys.includes(c.key)}
                    onCheckedChange={() => toggleHidden(c.key)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* yoğunluk */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Rows3 className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Satır yoğunluğu</DropdownMenuLabel>
              {DENSITIES.map((d) => (
                <DropdownMenuItem key={d.value} onClick={() => setDensity(d.value)}>
                  <span className={cn("flex-1", density === d.value && "font-medium text-primary")}>{d.label}</span>
                  {density === d.value && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          <Button variant="outline" size="sm" asChild>
            <Link href="/ice-aktar">
              <Upload className="h-3.5 w-3.5" />
              İçe aktar
            </Link>
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Yeni kişi
          </Button>
        </div>

        {/* etkin filtre rozetleri */}
        {filtersActive && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {state.search && (
              <FilterChip label={`"${state.search}"`} onRemove={() => setState((s) => ({ ...s, search: "" }))} />
            )}
            {state.quickView !== "all" && (
              <FilterChip label={activeQuickView?.label ?? state.quickView} onRemove={() => setState((s) => ({ ...s, quickView: "all" }))} />
            )}
            {state.rules.map((r) => {
              const f = FILTER_FIELDS.find((x) => x.key === r.field);
              const op = FILTER_OPS[f?.type ?? "text"].find((o) => o.value === r.op);
              return (
                <FilterChip
                  key={r.id}
                  label={`${f?.label} ${op?.label} ${r.value ?? ""}`.trim()}
                  onRemove={() => setState((s) => ({ ...s, rules: s.rules.filter((x) => x.id !== r.id) }))}
                />
              );
            })}
            <button className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setState(DEFAULT_VIEW_STATE)}>
              temizle
            </button>
          </div>
        )}
      </div>

      {/* ızgara */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Yükleniyor…</div>
      ) : (
        <DataGrid
          className="flex-1"
          rows={rows}
          columns={visibleColumns}
          rowKey={(p) => p.id}
          widths={widths}
          onWidthsChange={setWidths}
          sort={state.sort}
          onSortChange={(sort) => setState((s) => ({ ...s, sort }))}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          density={density}
          onEditCell={handleEditCell}
          onEditCells={handleEditCells}
          onCreateRows={handleCreateRows}
          onOpenRow={(p) => setOpenId(p.id)}
          onUndo={handleUndo}
          emptyState={
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                {allPeople.length === 0 ? "Henüz kişi yok." : "Filtrelere uyan kişi bulunamadı."}
              </p>
              {allPeople.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setState(DEFAULT_VIEW_STATE)}>
                  Filtreleri temizle
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* alt bilgi */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t bg-background px-4 text-xs text-muted-foreground">
        <span>
          {rows.length === allPeople.length ? `${allPeople.length} kişi` : `${rows.length} / ${allPeople.length} kişi`}
          {selectedIds.size > 0 && ` · ${selectedIds.size} seçili`}
        </span>
        <span className="hidden gap-3 md:flex">
          <kbd className="rounded border bg-muted px-1">çift tık</kbd> düzenle
          <kbd className="rounded border bg-muted px-1">Shift+Enter</kbd> detay
          <kbd className="rounded border bg-muted px-1">Ctrl+V</kbd> yapıştır
          <kbd className="rounded border bg-muted px-1">Ctrl+Z</kbd> geri al
        </span>
      </div>

      {/* toplu işlem çubuğu */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-14 left-1/2 z-40 flex -translate-x-1/2 animate-slide-up items-center gap-1 rounded-lg border bg-popover p-1.5 shadow-xl">
          <span className="px-2 text-xs font-medium">{selectedIds.size} kişi seçili</span>
          <span className="mx-1 h-5 w-px bg-border" />
          <TagPopover onApply={(tag) => bulkAction({ op: "tag", ids: [...selectedIds], tags: [tag] }, `Etiket eklendi: ${tag}`)} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs">
                <UserCheck className="h-3.5 w-3.5" /> Sorumlu ata
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {users.map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => bulkAction({ op: "owner", ids: [...selectedIds], ownerId: u.id }, `Sorumlu: ${u.name}`)}>
                  {u.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="xs" onClick={handleUndo}>
            <Undo2 className="h-3.5 w-3.5" /> Geri al
          </Button>
          <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget("bulk")}>
            <Trash2 className="h-3.5 w-3.5" /> Sil
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setSelectedIds(new Set())} aria-label="Seçimi temizle">
            <X />
          </Button>
        </div>
      )}

      {/* çekmece + pencereler */}
      <PersonDrawer
        personId={openId}
        open={Boolean(openId)}
        onOpenChange={(v) => !v && setOpenId(null)}
        onPersonChanged={() => queryClient.invalidateQueries({ queryKey: ["people"] })}
        onDelete={(p) => setDeleteTarget(p)}
      />
      <NewPersonDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        users={users}
        onCreated={(p) => {
          queryClient.setQueryData<{ people: Person[] }>(["people"], (old) => (old ? { ...old, people: [p, ...old.people] } : old));
          setOpenId(p.id);
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={deleteTarget === "bulk" ? `${selectedIds.size} kişiyi sil` : deleteTarget ? `${personName(deleteTarget)} kişisini sil` : ""}
        description="Bu kişi, görüşmeleri ve etkinlik kayıtlarıyla birlikte kalıcı olarak silinecek."
        confirmLabel="Sil"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-accent px-2 py-0.5 text-accent-foreground">
      {label}
      <button onClick={onRemove} className="opacity-60 hover:opacity-100" aria-label="Filtreyi kaldır">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function TagPopover({ onApply }: { onApply: (tag: string) => void }) {
  const [tag, setTag] = React.useState("");
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs">
          <Tags className="h-3.5 w-3.5" /> Etiket ver
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2.5" align="center">
        <Input
          autoFocus
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Etiket adı"
          onKeyDown={(e) => {
            if (e.key === "Enter" && tag.trim()) {
              onApply(tag.trim());
              setTag("");
              setOpen(false);
            }
          }}
        />
        <Button
          size="xs"
          className="mt-2 w-full"
          disabled={!tag.trim()}
          onClick={() => {
            onApply(tag.trim());
            setTag("");
            setOpen(false);
          }}
        >
          Uygula
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ---------- filtre editörü ----------

function FilterEditor({ rules, onChange }: { rules: import("@/lib/types").FilterRule[]; onChange: (rules: import("@/lib/types").FilterRule[]) => void }) {
  const addRule = () => {
    onChange([...rules, { id: crypto.randomUUID(), field: "firstName", op: "contains", value: "" }]);
  };

  const updateRule = (id: string, patch: Partial<import("@/lib/types").FilterRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Tüm koşullar sağlanır (VE)</p>
      {rules.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Henüz koşul yok. Filtre ekleyin.</p>}
      {rules.map((rule) => {
        const field = FILTER_FIELDS.find((f) => f.key === rule.field) ?? FILTER_FIELDS[0];
        const ops = FILTER_OPS[field.type];
        const needsValue = !["isEmpty", "isNotEmpty"].includes(rule.op);
        return (
          <div key={rule.id} className="flex items-center gap-1.5">
            <select
              value={rule.field}
              onChange={(e) => {
                const f2 = FILTER_FIELDS.find((f) => f.key === e.target.value)!;
                updateRule(rule.id, { field: e.target.value, op: FILTER_OPS[f2.type][0].value, value: "" });
              }}
              className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs"
            >
              {FILTER_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={rule.op}
              onChange={(e) => updateRule(rule.id, { op: e.target.value as FilterOp })}
              className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs"
            >
              {ops.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {needsValue &&
              (field.type === "date" ? (
                <Input
                  type="date"
                  className="h-8 flex-1 text-xs"
                  value={rule.value ?? ""}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                />
              ) : (
                <Input
                  className="h-8 flex-1 text-xs"
                  placeholder={field.type === "number" ? "0" : "değer"}
                  type={field.type === "number" ? "number" : "text"}
                  value={rule.value ?? ""}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                />
              ))}
            <Button variant="ghost" size="icon-sm" onClick={() => onChange(rules.filter((r) => r.id !== rule.id))} aria-label="Koşulu sil">
              <X />
            </Button>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" size="xs" onClick={addRule}>
          <Plus className="h-3 w-3" /> Koşul ekle
        </Button>
        {rules.length > 0 && (
          <Button variant="ghost" size="xs" onClick={() => onChange([])}>
            Tümünü temizle
          </Button>
        )}
      </div>
    </div>
  );
}
