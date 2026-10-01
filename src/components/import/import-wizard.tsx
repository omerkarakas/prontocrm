"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, ClipboardPaste, CloudUpload, Loader2, PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/client-api";
import { IMPORT_TARGETS, guessTarget } from "@/lib/constants";
import { normalizePhone } from "@/lib/utils";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Source = "excel" | "sheets" | "hubspot" | "zoho";
type Parsed = { headers: string[]; rows: string[][] };

const SOURCES: { id: Source; label: string; desc: string; icon: React.ElementType; defaultSource: string }[] = [
  { id: "excel", label: "Excel / CSV dosyası", desc: ".xlsx, .xls veya .csv dosyası yükle", icon: FileSpreadsheet, defaultSource: "Excel" },
  { id: "sheets", label: "Google Sheets", desc: "Sayfadan kopyala, buraya yapıştır", icon: ClipboardPaste, defaultSource: "Google Sheets" },
  { id: "hubspot", label: "HubSpot", desc: "HubSpot kişiler CSV dışa aktarımı", icon: CloudUpload, defaultSource: "HubSpot" },
  { id: "zoho", label: "Zoho CRM", desc: "Zoho kişi modülü CSV dışa aktarımı", icon: CloudUpload, defaultSource: "Zoho" },
];

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  conversations: number;
  invalidEmails: number;
}

export function ImportWizard() {
  const [step, setStep] = React.useState(0);
  const [source, setSource] = React.useState<Source>("excel");
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, number>>({});
  const [policy, setPolicy] = React.useState<"skip" | "update" | "insert">("update");
  const [sourceLabel, setSourceLabel] = React.useState("Excel");
  const [ownerId, setOwnerId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const { data: usersData } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<{ users: User[] }>("/api/users") });
  const users = usersData?.users ?? [];

  const parseText = (text: string, name?: string) => {
    const isCsv = name ? /\.(csv|txt)$/i.test(name) : true;
    if (isCsv || !/\t/.test(text)) {
      import("papaparse").then((Papa) => {
        const out = Papa.default.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" });
        const rows = out.data as unknown as string[][];
        if (rows.length < 2) {
          toast.error("Dosyada başlık satırı ve en az bir veri satırı olmalı.");
          return;
        }
        applyParsed(rows);
      });
    } else {
      const rows = text.replace(/\r/g, "").split("\n").map((l) => l.split("\t"));
      applyParsed(rows);
    }
  };

  const parseFile = async (file: File) => {
    if (/\.xlsx?$/i.test(file.name)) {
      setBusy(true);
      try {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
        const strRows = rows.map((r) => r.map((c) => (c == null ? "" : String(c))));
        if (strRows.length < 2) {
          toast.error("Dosyada başlık satırı ve en az bir veri satırı olmalı.");
          return;
        }
        applyParsed(strRows);
      } catch {
        toast.error("Dosya okunamadı. CSV olarak kaydedip tekrar deneyin.");
      } finally {
        setBusy(false);
      }
    } else {
      const text = await file.text();
      parseText(text, file.name);
    }
  };

  const applyParsed = (rows: string[][]) => {
    const headers = rows[0].map((h, i) => (String(h).trim() || `Sütun ${i + 1}`));
    const dataRows = rows.slice(1).map((r) => headers.map((_, i) => String(r[i] ?? "")));
    const guessed: Record<string, number> = {};
    const used = new Set<number>();
    for (const t of IMPORT_TARGETS) {
      const idx = headers.findIndex((h, i) => !used.has(i) && guessTarget(h) === t.key);
      if (idx >= 0) {
        guessed[t.key] = idx;
        used.add(idx);
      }
    }
    // "name" başlığı tek sütunsa ad'a eşle
    if (guessed.firstName === undefined) {
      const nameIdx = headers.findIndex((h, i) => !used.has(i) && /^name$|^full ?name$|^ad soyad$/i.test(h.trim()));
      if (nameIdx >= 0) guessed.firstName = nameIdx;
    }
    setMapping(guessed);
    setParsed({ headers, rows: dataRows });
    setStep(1);
  };

  const downloadSample = () => {
    const csv = [
      "Ad,Soyad,E-posta,Telefon,Şirket,Şehir,Etiketler",
      "Zeynep,Kaya,zeynep.kaya@ornek.com,+90 532 111 22 33,Örnek A.Ş.,İstanbul,VIP",
      "Mert,Demir,mert.demir@ornek.com,0533 444 55 66,,Ankara,Kurumsal",
    ].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pronto-ornek-kisiler.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // eşleştirilmiş satırları hazırla
  const buildRows = () => {
    if (!parsed) return [];
    const out: Record<string, string>[] = [];
    for (const row of parsed.rows) {
      const obj: Record<string, string> = {};
      let hasAny = false;
      for (const t of IMPORT_TARGETS) {
        const idx = mapping[t.key];
        if (idx === undefined || idx < 0) continue;
        let v = String(row[idx] ?? "").trim();
        if (!v) continue;
        if (t.key === "phone") v = normalizePhone(v) || v;
        if (t.key === "conversationDate") v = parseFlexibleDate(v) ?? v;
        obj[t.key] = v;
        hasAny = true;
      }
      if (hasAny) out.push(obj);
    }
    return out;
  };

  const rowsForPreview = React.useMemo(() => buildRows(), [parsed, mapping]); // eslint-disable-line react-hooks/exhaustive-deps

  const missingRequired = !mapping.firstName && !mapping.lastName && !mapping.email;

  const submit = async () => {
    const rows = buildRows();
    if (rows.length === 0) {
      toast.error("Eşleştirilmiş veri yok.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<ImportResult>("/api/import", {
        rows,
        duplicatePolicy: policy,
        defaultSource: sourceLabel,
      });
      setResult(res);
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İçe aktarma başarısız");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setParsed(null);
    setResult(null);
    setMapping({});
  };

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto thin-scroll p-6">
      {/* adımlar */}
      <ol className="mb-6 flex items-center gap-2 text-sm">
        {["Kaynak", "Eşleştirme", "Sonuç"].map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 && <span className="h-px w-8 bg-border" />}
            <li className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  step === i ? "bg-primary text-primary-foreground" : step > i ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {step > i ? "✓" : i + 1}
              </span>
              <span className={step === i ? "font-medium" : "text-muted-foreground"}>{label}</span>
            </li>
          </React.Fragment>
        ))}
      </ol>

      {step === 0 && (
        <div className="animate-fade-in space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Veriniz nerede?</h2>
              <p className="text-sm text-muted-foreground">Başlık satırları Türkçe veya İngilizce olabilir; sütunları otomatik tanırız.</p>
            </div>
            <Button variant="link" size="sm" onClick={downloadSample}>
              Örnek CSV indir
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSource(s.id);
                  setSourceLabel(s.defaultSource);
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/50",
                  source === s.id && "border-primary bg-accent/40"
                )}
              >
                <s.icon className="mt-0.5 h-5 w-5 text-primary" />
                <span>
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>

          {(source === "excel" || source === "hubspot" || source === "zoho") && (
            <FileDrop onFile={parseFile} busy={busy} />
          )}
          {source === "sheets" && (
            <div className="space-y-2">
              <Label htmlFor="paste-area">Google Sheets'ten kopyaladığınız hücreleri buraya yapıştırın</Label>
              <textarea
                id="paste-area"
                className="thin-scroll min-h-40 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
                placeholder={"Ad\tSoyad\tE-posta\tTelefon\nZeynep\tKaya\tzeynep@ornek.com\t+90 532…"}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text/plain");
                  if (text) {
                    e.preventDefault();
                    parseText(text);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">İpucu: Sayfada hücre aralığını seçip Ctrl+C ile kopyalayın, sonra buraya tıklayıp Ctrl+V yapın.</p>
            </div>
          )}
        </div>
      )}

      {step === 1 && parsed && (
        <div className="animate-fade-in space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Sütunları eşleştir</h2>
              <p className="text-sm text-muted-foreground">
                {parsed.rows.length} satır, {parsed.headers.length} sütun algılandı. Otomatik eşleştirmeyi kontrol edin.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <ArrowLeft className="h-3.5 w-3.5" /> Yeni veri
            </Button>
          </div>

          {missingRequired && (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              Ad, Soyad veya E-posta alanlarından en az birini eşleştirin.
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {IMPORT_TARGETS.map((t) => {
              const idx = mapping[t.key];
              const sample = idx !== undefined && idx >= 0 ? parsed.rows[0]?.[idx] ?? "" : "";
              return (
                <div key={t.key} className="flex items-center gap-2 rounded-md border p-2">
                  <span className="w-36 shrink-0 text-xs font-medium">
                    {t.label}
                    {t.required && <span className="text-destructive">*</span>}
                    {t.kind === "conversation" && <Badge variant="muted" className="ml-1 text-[9px]">görüşme</Badge>}
                  </span>
                  <Select
                    value={idx !== undefined && idx >= 0 ? String(idx) : "none"}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [t.key]: v === "none" ? -1 : Number(v) }))}
                  >
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Sütun seç…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— eşleştirme yok —</SelectItem>
                      {parsed.headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="w-32 shrink-0 truncate text-[11px] text-muted-foreground" title={sample}>
                    {sample || "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* önizleme */}
          {rowsForPreview.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Önizleme (ilk 5 kayıt)</p>
              <div className="thin-scroll overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      {IMPORT_TARGETS.filter((t) => mapping[t.key] !== undefined && mapping[t.key] >= 0).map((t) => (
                        <th key={t.key} className="whitespace-nowrap px-2.5 py-1.5 font-medium">
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsForPreview.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t">
                        {IMPORT_TARGETS.filter((t) => mapping[t.key] !== undefined && mapping[t.key] >= 0).map((t) => (
                          <td key={t.key} className="max-w-40 truncate whitespace-nowrap px-2.5 py-1.5">
                            {r[t.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* seçenekler */}
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Aynı e-posta varsa</Label>
              <Select value={policy} onValueChange={(v) => setPolicy(v as typeof policy)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">Mevcut kaydı güncelle</SelectItem>
                  <SelectItem value="skip">Atla</SelectItem>
                  <SelectItem value="insert">Yeni kayıt olarak ekle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sorumlu</Label>
              <Select value={ownerId || "me"} onValueChange={setOwnerId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Ben</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kaynak etiketi</Label>
              <Input className="h-9" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>Vazgeç</Button>
            <Button onClick={submit} disabled={busy || missingRequired || rowsForPreview.length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? "Aktarılıyor…" : `${rowsForPreview.length} kaydı içe aktar`}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && result && (
        <div className="animate-slide-up flex flex-col items-center py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <PartyPopper className="h-8 w-8" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">İçe aktarma tamamlandı</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <ResultStat label="Yeni kişi" value={result.inserted} />
            <ResultStat label="Güncellenen" value={result.updated} />
            <ResultStat label="Atlanan" value={result.skipped} />
            <ResultStat label="Görüşme" value={result.conversations} />
          </div>
          {result.invalidEmails > 0 && (
            <p className="mt-4 text-xs text-warning">{result.invalidEmails} satırda geçersiz e-posta vardı; kayıtlar yine de eklendi.</p>
          )}
          <div className="mt-8 flex gap-2">
            <Button variant="outline" onClick={reset}>
              Başka içe aktar
            </Button>
            <Button asChild>
              <Link href="/kisiler">
                <CheckCircle2 className="h-4 w-4" /> Kişilere git
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FileDrop({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors",
        dragOver ? "border-primary bg-accent/40" : "hover:border-muted-foreground/40"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <CloudUpload className="h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm">Dosyayı buraya sürükleyin veya</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {busy ? "Okunuyor…" : "Dosya seç"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">.xlsx, .xls veya .csv · UTF-8 önerilir</p>
    </div>
  );
}

/** "31.12.2026", "31/12/2026", "2026-12-31" → ISO; tanımazsa null */
function parseFlexibleDate(v: string): string | null {
  const m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}
