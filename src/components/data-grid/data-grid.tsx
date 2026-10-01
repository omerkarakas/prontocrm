"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronUp, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { SortState } from "@/lib/types";

export type GridDensity = "compact" | "normal" | "relaxed";

export interface GridColumn<T> {
  key: string;
  label: string;
  width: number;
  /** '__select', '__index' ve '__actions' grid tarafından özel işlenir.
   *  'select': açılır listeden seçim — hücrenin mevcut değeri listede yoksa
   *  "(listede yok)" etiketiyle listeye eklenir, veri kaybı olmaz. */
  type?: "text" | "email" | "phone" | "date" | "select" | "tags";
  editable?: boolean;
  options?: { value: string; label: string }[];
  sticky?: boolean;
  align?: "left" | "right" | "center";
  render: (row: T, rowIndex: number) => React.ReactNode;
  stringValue?: (row: T) => string;
}

export interface CellEdit {
  id: string;
  field: string;
  value: string;
}

interface DataGridProps<T> {
  rows: T[];
  columns: GridColumn<T>[];
  rowKey: (row: T) => string;
  widths: Record<string, number>;
  onWidthsChange: (widths: Record<string, number>) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  density?: GridDensity;
  onEditCell?: (row: T, col: GridColumn<T>, value: string) => Promise<boolean> | boolean;
  onEditCells?: (edits: CellEdit[]) => Promise<void>;
  onCreateRows?: (rows: Record<string, string>[]) => Promise<void>;
  onOpenRow?: (row: T) => void;
  onUndo?: () => void;
  onRowAction?: (row: T, action: string) => void;
  emptyState?: React.ReactNode;
  className?: string;
}

const ROW_H: Record<GridDensity, number> = { compact: 32, normal: 40, relaxed: 48 };

export function DataGrid<T>({
  rows,
  columns,
  rowKey,
  widths,
  onWidthsChange,
  sort,
  onSortChange,
  selectedIds,
  onSelectedIdsChange,
  density = "normal",
  onEditCell,
  onEditCells,
  onCreateRows,
  onOpenRow,
  onUndo,
  onRowAction,
  emptyState,
  className,
}: DataGridProps<T>) {
  const [active, setActive] = React.useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = React.useState<{ r: number; c: number; value: string } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rowHeight = ROW_H[density];

  const hasSelection = !!selectedIds && !!onSelectedIdsChange;

  const cellValue = React.useCallback((row: T, col: GridColumn<T>): string => {
    if (col.type === "select") {
      const opts = col.options ?? [];
      return opts.find((o) => o.value === (row as Record<string, unknown>)[col.key])?.label ?? String((row as Record<string, unknown>)[col.key] ?? "");
    }
    const v = (row as Record<string, unknown>)[col.key];
    if (Array.isArray(v)) return v.join(", ");
    return v == null ? "" : String(v);
  }, []);

  const commitEdit = React.useCallback(
    async (r: number, c: number, value: string) => {
      const row = rows[r];
      const col = columns[c];
      setEditing(null);
      if (!row || !col || !col.editable || !onEditCell) return;
      const current = col.type === "select" ? String((row as Record<string, unknown>)[col.key] ?? "") : cellValue(row, col);
      if (value === current) return;
      await onEditCell(row, col, value);
    },
    [rows, columns, onEditCell, cellValue]
  );

  const move = React.useCallback(
    (dr: number, dc: number) => {
      if (!active) {
        if (rows.length && columns.length) setActive({ r: 0, c: 0 });
        return;
      }
      const r = Math.max(0, Math.min(rows.length - 1, active.r + dr));
      const c = Math.max(0, Math.min(columns.length - 1, active.c + dc));
      if (r !== active.r || c !== active.c) setActive({ r, c });
    },
    [active, rows.length, columns.length]
  );

  const startEdit = React.useCallback(
    (r: number, c: number, initialValue?: string) => {
      const row = rows[r];
      const col = columns[c];
      if (!row || !col) return;
      if (col.key === "__select" || col.key === "__index") return;
      if (col.editable) {
        setEditing({ r, c, value: initialValue ?? (col.type === "select" ? String((row as Record<string, unknown>)[col.key] ?? "") : cellValue(row, col)) });
      } else {
        onOpenRow?.(row);
      }
    },
    [rows, columns, onOpenRow, cellValue]
  );

  const copySelection = React.useCallback(() => {
    if (editing) return;
    let text = "";
    if (selectedIds && selectedIds.size > 0) {
      const selRows = rows.filter((r) => selectedIds.has(rowKey(r)));
      text = selRows
        .map((row) => columns.filter((c) => !c.key.startsWith("__")).map((c) => c.stringValue?.(row) ?? cellValue(row, c)).join("\t"))
        .join("\n");
    } else if (active) {
      const row = rows[active.r];
      const col = columns[active.c];
      if (row && col) text = col.stringValue?.(row) ?? cellValue(row, col);
    }
    if (!text) return;
    void copyToClipboard(text);
    const count = text.split("\n").length;
    toast.success(count > 1 ? `${count} satır kopyalandı` : "Kopyalandı", {
      description: "Google Sheets veya Excel'e yapıştırabilirsiniz.",
    });
  }, [editing, selectedIds, rows, columns, active, rowKey, cellValue]);

  const handlePaste = React.useCallback(
    async (text: string) => {
      if (editing || !active) return;
      const pasteRows = text
        .replace(/\r/g, "")
        .split("\n")
        .filter((l, i, arr) => !(l === "" && i === arr.length - 1))
        .map((l) => l.split("\t"));
      if (pasteRows.length === 0) return;

      const start = active;
      let startC = start.c;
      while (startC < columns.length && !columns[startC].editable) startC++;
      if (startC >= columns.length) {
        toast.error("Bu sütundan itibaren düzenlenebilir alan yok");
        return;
      }

      const edits: CellEdit[] = [];
      const newRows: Record<string, string>[] = [];
      let skipped = 0;

      for (let i = 0; i < pasteRows.length; i++) {
        const pasteRow = pasteRows[i];
        const targetRow = rows[start.r + i];
        if (targetRow) {
          for (let j = 0; j < pasteRow.length; j++) {
            const col = columns[startC + j];
            if (!col || !col.editable) continue;
            const value = pasteRow[j].trim();
            if (col.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
              skipped++;
              continue;
            }
            edits.push({ id: rowKey(targetRow), field: col.key, value });
          }
        } else if (onCreateRows) {
          const obj: Record<string, string> = {};
          for (let j = 0; j < pasteRow.length; j++) {
            const col = columns[startC + j];
            if (col && col.editable) obj[col.key] = pasteRow[j].trim();
          }
          if (Object.keys(obj).length) newRows.push(obj);
        }
      }

      let cellCount = edits.length;
      if (edits.length && onEditCells) await onEditCells(edits);
      else if (edits.length && onEditCell) {
        for (const ed of edits) {
          const row = rows.find((r) => rowKey(r) === ed.id);
          const col = columns.find((c) => c.key === ed.field);
          if (row && col) await onEditCell(row, col, ed.value);
        }
      }
      if (newRows.length && onCreateRows) {
        await onCreateRows(newRows);
        cellCount += newRows.length * Object.keys(newRows[0]).length;
      }
      if (cellCount > 0) {
        toast.success(`${cellCount} hücre güncellendi${newRows.length ? `, ${newRows.length} yeni kişi eklendi` : ""}`, {
          action: onUndo ? { label: "Geri al", onClick: onUndo } : undefined,
        });
      }
      if (skipped > 0) toast.warning(`${skipped} geçersiz e-posta atlandı`);
    },
    [editing, active, columns, rows, rowKey, onEditCells, onEditCell, onCreateRows, onUndo]
  );

  const toggleSelect = (id: string) => {
    if (!selectedIds || !onSelectedIdsChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const inFormField = ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
    if (editing && inFormField) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      copySelection();
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      onUndo?.();
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      if (e.shiftKey && active) {
        const row = rows[active.r];
        if (row) {
          onOpenRow?.(row);
          e.preventDefault();
        }
        return;
      }
      if (active && columns[active.c] && !columns[active.c].key.startsWith("__")) {
        startEdit(active.r, active.c);
        if (columns[active.c].editable) e.preventDefault();
      }
      return;
    }
    if (e.key === "F2" && active) {
      startEdit(active.r, active.c);
      e.preventDefault();
      return;
    }
    if (e.key === "Tab") {
      move(0, e.shiftKey ? -1 : 1);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") { move(1, 0); e.preventDefault(); return; }
    if (e.key === "ArrowUp") { move(-1, 0); e.preventDefault(); return; }
    if (e.key === "ArrowLeft") { move(0, -1); e.preventDefault(); return; }
    if (e.key === "ArrowRight") { move(0, 1); e.preventDefault(); return; }
    if (e.key === " " && active && hasSelection) {
      const row = rows[active.r];
      if (row) toggleSelect(rowKey(row));
      e.preventDefault();
      return;
    }
    if (e.key === "Delete" && active) {
      const col = columns[active.c];
      const row = rows[active.r];
      if (col?.editable && row && onEditCell) onEditCell(row, col, "");
      e.preventDefault();
      return;
    }
    if (!inFormField && active && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const col = columns[active.c];
      if (col?.editable) {
        startEdit(active.r, active.c, e.key);
        e.preventDefault();
      }
    }
  };

  const allSelected = hasSelection && rows.length > 0 && rows.every((r) => selectedIds!.has(rowKey(r)));
  const someSelected = hasSelection && selectedIds!.size > 0 && !allSelected;

  const handleSort = (col: GridColumn<T>) => {
    if (!onSortChange || col.key.startsWith("__")) return;
    if (!sort || sort.key !== col.key) onSortChange({ key: col.key, dir: "asc" });
    else if (sort.dir === "asc") onSortChange({ key: col.key, dir: "desc" });
    else onSortChange(null);
  };

  React.useEffect(() => {
    if (!active || editing) return;
    const el = containerRef.current?.querySelector(`[data-cell="${active.r}:${active.c}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, editing]);

  if (rows.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  // sticky sol offset hesabı
  let stickyOffset = 0;
  const stickyLefts = columns.map((col) => {
    if (col.sticky) {
      const left = stickyOffset;
      stickyOffset += widths[col.key] ?? col.width;
      return left;
    }
    return -1;
  });

  return (
    <div
      ref={containerRef}
      role="grid"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPaste={(e) => {
        const el = document.activeElement;
        if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
        const text = e.clipboardData.getData("text/plain");
        if (text) {
          e.preventDefault();
          void handlePaste(text);
        }
      }}
      className={cn("relative overflow-auto thin-scroll bg-background outline-none", className)}
    >
      <div className="inline-block min-w-full align-top">
        <div role="row" className="sticky top-0 z-30 flex border-b bg-muted/80 backdrop-blur-sm" style={{ height: 36 }}>
          {columns.map((col, ci) => {
            const sorted = sort?.key === col.key;
            return (
              <div
                key={col.key}
                role="columnheader"
                style={{ width: widths[col.key] ?? col.width, left: stickyLefts[ci] >= 0 ? stickyLefts[ci] : undefined }}
                className={cn(
                  "group/header relative flex shrink-0 items-center gap-1 border-r px-2 text-xs font-medium text-muted-foreground select-none last:border-r-0",
                  col.sticky && "sticky z-30 bg-muted",
                  col.align === "right" && "justify-end",
                  col.align === "center" && "justify-center",
                  !col.key.startsWith("__") && "cursor-pointer hover:text-foreground"
                )}
                onClick={() => handleSort(col)}
              >
                <span className="truncate">{col.label}</span>
                {sorted ? (
                  sort!.dir === "asc" ? (
                    <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
                  ) : (
                    <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
                  )
                ) : !col.key.startsWith("__") ? (
                  <ChevronUp className="h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover/header:opacity-60" />
                ) : null}
                <ResizeHandle
                  currentWidth={widths[col.key] ?? col.width}
                  onResize={(w) => onWidthsChange({ ...widths, [col.key]: w })}
                />
              </div>
            );
          })}
        </div>

        {rows.map((row, ri) => {
          const id = rowKey(row);
          const isSelected = selectedIds?.has(id);
          return (
            <div
              key={id}
              role="row"
              className={cn("pgrid-row group flex border-b border-border/60", isSelected && "is-selected")}
              style={{ height: rowHeight }}
            >
              {columns.map((col, ci) => {
                const isActive = active?.r === ri && active?.c === ci && !editing;
                const isEditing = editing?.r === ri && editing?.c === ci;
                const stickyStyle = {
                  width: widths[col.key] ?? col.width,
                  left: stickyLefts[ci] >= 0 ? stickyLefts[ci] : undefined,
                } as React.CSSProperties;

                if (col.key === "__select") {
                  return (
                    <div
                      key={col.key}
                      role="gridcell"
                      style={stickyStyle}
                      className={cn("pgrid-cell sticky is-sticky z-10 flex shrink-0 items-center justify-center border-r", isActive && "is-active")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(id)}
                        aria-label="Satırı seç"
                        className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100"
                      />
                    </div>
                  );
                }
                if (col.key === "__index") {
                  return (
                    <div
                      key={col.key}
                      role="gridcell"
                      data-cell={`${ri}:${ci}`}
                      style={stickyStyle}
                      className={cn(
                        "pgrid-cell sticky is-sticky z-10 flex shrink-0 items-center justify-end border-r pr-2 text-[11px] tabular-nums text-muted-foreground/70",
                        isActive && "is-active"
                      )}
                      onClick={() => setActive({ r: ri, c: ci })}
                    >
                      {ri + 1}
                    </div>
                  );
                }
                if (col.key === "__actions") {
                  return (
                    <div
                      key={col.key}
                      role="gridcell"
                      style={stickyStyle}
                      className={cn("pgrid-cell flex shrink-0 items-center justify-center", isActive && "is-active")}
                      onClick={() => setActive({ r: ri, c: ci })}
                    >
                      {onRowAction && (
                        <button
                          className="rounded p-1 opacity-0 hover:bg-muted group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowAction(row, "menu");
                          }}
                          aria-label="Satır eylemleri"
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={col.key}
                    role="gridcell"
                    data-cell={`${ri}:${ci}`}
                    style={stickyStyle}
                    className={cn(
                      "pgrid-cell flex shrink-0 items-center border-r px-2 text-[13px] last:border-r-0",
                      col.sticky && "sticky is-sticky z-10",
                      isActive && "is-active",
                      col.align === "right" && "justify-end",
                      col.align === "center" && "justify-center"
                    )}
                    onClick={() => setActive({ r: ri, c: ci })}
                    onDoubleClick={() => startEdit(ri, ci)}
                  >
                    {isEditing ? (
                      <CellEditor
                        col={col}
                        initialValue={editing!.value}
                        onCommit={(v, moveDir) => {
                          void commitEdit(ri, ci, v);
                          if (moveDir === "down") setActive({ r: Math.min(rows.length - 1, ri + 1), c: ci });
                          if (moveDir === "right") setActive({ r: ri, c: Math.min(columns.length - 1, ci + 1) });
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <div className={cn("w-full truncate", isActive && "pointer-events-none")}>{col.render(row, ri)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CellEditorProps<T> {
  col: GridColumn<T>;
  initialValue: string;
  onCommit: (value: string, move?: "down" | "right") => void;
  onCancel: () => void;
}

function CellEditor<T>({ col, initialValue, onCommit, onCancel }: CellEditorProps<T>) {
  const [value, setValue] = React.useState(initialValue);
  const ref = React.useRef<HTMLInputElement | HTMLSelectElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (el instanceof HTMLInputElement) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    } else {
      el?.focus();
    }
  }, []);

  const commit = (move?: "down" | "right") => {
    if (col.type === "email" && value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) {
      onCancel();
      toast.error("Geçerli bir e-posta adresi girin");
      return;
    }
    onCommit(value, move);
  };

  const keyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      commit("down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit("right");
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  if (col.type === "select") {
    const opts = col.options ?? [];
    // hücrenin mevcut değeri listede yoksa koru (veri kaybı olmasın)
    const merged =
      value && !opts.some((o) => o.value === value)
        ? [{ value, label: `${value} (listede yok)` }, ...opts]
        : opts;
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onCommit(e.target.value);
        }}
        onBlur={() => commit()}
        onKeyDown={keyDown}
        className="cell-input cursor-pointer bg-background text-[13px]"
      >
        <option value="">—</option>
        {merged.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      value={value}
      type={col.type === "date" ? "date" : "text"}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => commit()}
      onKeyDown={keyDown}
      className="cell-input"
    />
  );
}

function ResizeHandle({ currentWidth, onResize }: { currentWidth: number; onResize: (newWidth: number) => void }) {
  const startX = React.useRef(0);
  return (
    <span
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        startX.current = e.clientX;
        const startPos = currentWidth;
        const onMove = (me: MouseEvent) => {
          onResize(Math.max(56, startPos + (me.clientX - startX.current)));
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

/** Sütun genişlikleri + görünürlük durumunu localStorage'da tutan hook */
export function useColumnState<T>(storageKey: string, columns: GridColumn<T>[]) {
  const [widths, setWidthsState] = React.useState<Record<string, number>>({});
  const [hiddenKeys, setHiddenKeys] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(`${storageKey}:widths`);
      if (raw) setWidthsState(JSON.parse(raw));
      const rawH = localStorage.getItem(`${storageKey}:hidden`);
      if (rawH) setHiddenKeys(JSON.parse(rawH));
    } catch {
      // localStorage kullanılamıyor
    }
  }, [storageKey]);

  const setWidths = (w: Record<string, number>) => {
    setWidthsState(w);
    try {
      localStorage.setItem(`${storageKey}:widths`, JSON.stringify(w));
    } catch {
      // yoksay
    }
  };

  const toggleHidden = (key: string) => {
    setHiddenKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(`${storageKey}:hidden`, JSON.stringify(next));
      } catch {
        // yoksay
      }
      return next;
    });
  };

  const visibleColumns = React.useMemo(() => columns.filter((c) => !hiddenKeys.includes(c.key)), [columns, hiddenKeys]);

  return { widths, setWidths, hiddenKeys, toggleHidden, visibleColumns };
}
