import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = {
  title: "设置 - Logos",
};

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <SettingsClient
      user={{ id: user.id, email: user.email, name: user.name, role: user.role }}
    />
  );
}
