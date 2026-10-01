"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Users, CalendarRange, ListTree, Upload, Settings2, Moon, Sun, Search, LogOut, Command as CommandIcon,
} from "lucide-react";
import { cn, initials, avatarColor, personName } from "@/lib/utils";
import { useUser } from "@/components/user-context";
import { CommandPalette } from "@/components/command-palette";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiPost } from "@/lib/client-api";

const NAV = [
  { href: "/kisiler", label: "Kişiler", icon: Users },
  { href: "/etkinlikler", label: "Etkinlikler", icon: CalendarRange },
  { href: "/liste-secenekleri", label: "Liste Seçenekleri", icon: ListTree },
  { href: "/ice-aktar", label: "İçe Aktar", icon: Upload },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings2 },
];

const TITLES: Record<string, string> = {
  "/kisiler": "Kişiler",
  "/etkinlikler": "Etkinlikler",
  "/liste-secenekleri": "Liste Seçenekleri",
  "/ice-aktar": "İçe Aktar",
  "/ayarlar": "Ayarlar",
};

export function AppShell({ orgName, children }: { orgName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const { theme, setTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = pathname.startsWith("/etkinlikler/")
    ? "Etkinlik detayı"
    : TITLES[pathname] ?? "Pronto CRM";

  const logout = async () => {
    await apiPost("/api/auth/logout");
    router.push("/login");
    router.refresh();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden">
        {/* kenar çubuğu */}
        <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
          <div className="px-4 pb-5 pt-5">
            <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-2">
              {/* logo.wordmark koyu olduğu için koyu zeminde beyaz zemin üzerine oturtulur */}
              <img src="/pronto-logo.png" alt="Pronto Eventi" className="h-5 w-auto" />
            </span>
            <p className="mt-1.5 text-[11px] text-sidebar-foreground/60">{orgName}</p>
          </div>

          <nav className="flex-1 space-y-0.5 px-2">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")) || (item.href === "/kisiler" && pathname === "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-primary/25 font-medium text-white" : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-teal-400" aria-hidden />}
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-white/5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={avatarColor(user.email)}>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-xs font-medium text-white">{user.name}</p>
                    <p className="truncate text-[10px] text-sidebar-foreground/60">
                      {user.role === "admin" ? "Yönetici" : "Ekip üyesi"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-52">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? <Sun /> : <Moon />} Gündüz / gece görünümü
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut /> Çıkış yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* içerik */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-5">
            <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={() => setPaletteOpen(true)}
              >
                <Search className="h-3.5 w-3.5" />
                Ara…
                <kbd className="ml-2 flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  <CommandIcon className="h-2.5 w-2.5" />K
                </kbd>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={() => setTheme(mounted && theme === "dark" ? "light" : "dark")}>
                    {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gündüz / gece</TooltipContent>
              </Tooltip>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </TooltipProvider>
  );
}
