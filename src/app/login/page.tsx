import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Giriş" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/kisiler");
  return <LoginForm />;
}
