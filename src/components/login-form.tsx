"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sheet, Timer, History } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/client-api";
import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost("/api/auth/login", { email, password, remember });
      router.push("/kisiler");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Giriş yapılamadı");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* marka paneli */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#04091E] p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-[0.14]" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(139,91,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,91,255,.5) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>
        <div className="absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-[#8B5BFF] opacity-25 blur-[120px]" aria-hidden />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[#00C0B8] opacity-20 blur-[110px]" aria-hidden />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <LogoMark className="h-7 w-7" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Pronto CRM</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <h1 className="text-3xl font-semibold leading-snug tracking-tight">
            E-tablo hızında müşteri takibi,
            <br />
            etkinlik ekibine özel.
          </h1>
          <ul className="space-y-4 text-sm text-white/75">
            <li className="flex gap-3">
              <Sheet className="mt-0.5 h-4 w-4 shrink-0 text-[#4AD9D2]" />
              Kişileri hücre hücre düzenle, Sheets'ten yapıştır, anında filtrele.
            </li>
            <li className="flex gap-3">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-[#4AD9D2]" />
              Kiminle, ne zaman, ne konuşuldu — kişi sayfasında netçe gör.
            </li>
            <li className="flex gap-3">
              <Timer className="mt-0.5 h-4 w-4 shrink-0 text-[#4AD9D2]" />
              HubSpot, Zoho ve e-tablolardaki veriyi saniyeler içinde taşı.
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/40">Pronto Etkinlik ekibi için prototip · v0.1</p>
      </div>

      {/* form */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <LogoMark className="h-6 w-6" />
            </span>
            <span className="text-lg font-semibold">Pronto CRM</span>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">Giriş yap</h2>
          <p className="mt-1 text-sm text-muted-foreground">Kayıtlara erişmek için hesabını kullan.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="ad@pronto.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              30 gün hatırla
            </label>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Giriş yapılıyor…" : "Giriş yap"}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo hesaplar</p>
            <div className="mt-1.5 grid gap-1">
              <button
                type="button"
                className="text-left hover:text-foreground"
                onClick={() => {
                  setEmail("ayse@pronto.app");
                  setPassword("pronto123");
                }}
              >
                ayse@pronto.app · pronto123 <span className="text-primary">(yönetici)</span>
              </button>
              <button
                type="button"
                className="text-left hover:text-foreground"
                onClick={() => {
                  setEmail("can@pronto.app");
                  setPassword("pronto123");
                }}
              >
                can@pronto.app · pronto123
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
