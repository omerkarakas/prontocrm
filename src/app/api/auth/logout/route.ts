import { destroySession } from "@/lib/auth";
import { json } from "@/lib/server";

export async function POST() {
  await destroySession();
  return json({ ok: true });
}
