import { requireApiUser, json, unauthorized } from "@/lib/server";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  return json(user);
}
