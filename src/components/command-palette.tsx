"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { User, CalendarRange, Upload, Settings2, Moon, Sun, Users } from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { apiGet } from "@/lib/client-api";
import { personName, formatRelative } from "@/lib/utils";
import type { Person, CrmEvent } from "@/lib/types";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const { data: people } = useQuery({
    queryKey: ["people"],
    queryFn: () => apiGet<{ people: Person[] }>("/api/people"),
    enabled: open,
  });
  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: () => apiGet<{ events: CrmEvent[] }>("/api/events"),
    enabled: open,
  });

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Kişi, etkinlik ara veya komut çalıştır…" />
      <CommandList>
        <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>

        {people && people.people.length > 0 && (
          <CommandGroup heading="Kişiler">
            {people.people.slice(0, 8).map((p) => (
              <CommandItem
                key={p.id}
                value={`kişi ${personName(p)} ${p.email} ${p.company}`}
                onSelect={() => run(() => router.push(`/kisiler?open=${p.id}`))}
              >
                <User className="text-muted-foreground" />
                <span>{personName(p)}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {p.lastConversationAt ? `son görüşme: ${formatRelative(p.lastConversationAt)}` : "hiç görüşülmedi"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {events && events.events.length > 0 && (
          <CommandGroup heading="Etkinlikler">
            {events.events.slice(0, 5).map((e) => (
              <CommandItem key={e.id} value={`etkinlik ${e.name} ${e.location}`} onSelect={() => run(() => router.push(`/etkinlikler/${e.id}`))}>
                <CalendarRange className="text-muted-foreground" />
                {e.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="Komutlar">
          <CommandItem onSelect={() => run(() => router.push("/kisiler?new=1"))}>
            <Users /> Yeni kişi ekle
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/ice-aktar"))}>
            <Upload /> Veri içe aktar
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/ayarlar"))}>
            <Settings2 /> Ayarları aç
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme(theme === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? <Sun /> : <Moon />} Gündüz / gece görünümünü değiştir
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
