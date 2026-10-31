import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return <LoginForm />;
}
