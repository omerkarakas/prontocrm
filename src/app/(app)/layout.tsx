import { requireUser } from "@/lib/auth";
import { getDb, getSetting } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { UserProvider } from "@/components/user-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const orgName = getSetting(getDb(), "orgName") ?? "Pronto Etkinlik";
  return (
    <UserProvider user={user}>
      <AppShell orgName={orgName}>{children}</AppShell>
    </UserProvider>
  );
}
