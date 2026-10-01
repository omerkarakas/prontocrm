"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLookups } from "@/components/lookups/use-lookups";
import { apiPost } from "@/lib/client-api";
import { isValidEmail } from "@/lib/utils";
import type { Person, User } from "@/lib/types";

export function NewPersonDialog({
  open,
  onOpenChange,
  users,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: User[];
  onCreated: (p: Person) => void;
}) {
  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "", phone: "", company: "", city: "" });
  const [ownerId, setOwnerId] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const lookups = useLookups();

  const cityOptions = React.useMemo(() => {
    const opts = lookups.city.map((c) => ({ value: c.value, label: c.value }));
    if (form.city && !opts.some((o) => o.value === form.city)) {
      return [{ value: form.city, label: `${form.city} (listede yok)` }, ...opts];
    }
    return opts;
  }, [lookups.city, form.city]);

  React.useEffect(() => {
    if (open) {
      setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", city: "" });
      setOwnerId(users[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.firstName.trim() && !form.lastName.trim() && !form.email.trim()) {
      toast.error("En az ad, soyad veya e-posta girin");
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email)) {
      toast.error("Geçerli bir e-posta adresi girin");
      return;
    }
    setSaving(true);
    try {
      const person = await apiPost<Person>("/api/people", { ...form, ownerId: ownerId || null, source: "Manuel" });
      toast.success("Kişi eklendi");
      onOpenChange(false);
      onCreated(person);
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
          <DialogTitle>Yeni kişi</DialogTitle>
          <DialogDescription>Temel bilgileri girin; gerisini kayıt sayfasından tamamlayabilirsiniz.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Ad</Label>
            <Input autoFocus value={form.firstName} onChange={set("firstName")} placeholder="Zeynep" />
          </div>
          <div className="space-y-1.5">
            <Label>Soyad</Label>
            <Input value={form.lastName} onChange={set("lastName")} placeholder="Kaya" />
          </div>
          <div className="space-y-1.5">
            <Label>E-posta</Label>
            <Input type="email" value={form.email} onChange={set("email")} placeholder="zeynep@sirket.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={set("phone")} placeholder="+90 5…" />
          </div>
          <div className="space-y-1.5">
            <Label>Şirket</Label>
            <Input value={form.company} onChange={set("company")} />
          </div>
          <div className="space-y-1.5">
            <Label>Şehir</Label>
            <Select value={form.city || "__bos"} onValueChange={(v) => setForm((f) => ({ ...f, city: v === "__bos" ? "" : v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seçin…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__bos">— (boş)</SelectItem>
                {cityOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Sorumlu</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seçin…" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Ekleniyor…" : "Kişiyi ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
