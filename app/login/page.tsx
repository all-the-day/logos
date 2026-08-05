import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "登录 - Logos",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/plan");

  return <LoginClient />;
}
