import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import type { User, Role } from "./types";
import { genId, nowIso } from "./utils";

export const SESSION_COOKIE = "pronto_session";

export function hashPassword(password: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("bcryptjs").hashSync(password, 10) as string;
}

export function verifyPassword(password: string, hash: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("bcryptjs").compareSync(password, hash) as boolean;
}

export function sha256(input: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(input).digest("hex");
}

export async function createSession(userId: string, remember: boolean): Promise<string> {
  const db = getDb();
  const token = genId() + genId().replace(/-/g, "");
  const days = remember ? 30 : 1;
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?,?,?,?)").run(
    token, userId, expires, nowIso()
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 86400,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    store.delete(SESSION_COOKIE);
  }
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as
    | { id: string; name: string; email: string; role: Role; active: number; created_at: string; expires_at: string }
    | undefined;
  if (!row || !row.active || row.expires_at < nowIso()) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role, active: true, createdAt: row.created_at };
}

/** Sayfa (server component) için: oturum yoksa /login'e yönlendirir. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** API route için: oturum yoksa null döner; handler 401 döndürür. */
export async function requireApiUser(): Promise<User | null> {
  return getSessionUser();
}
