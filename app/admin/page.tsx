import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "后台管理 - Logos",
};

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/plan");

  return (
    <AdminClient
      user={{ id: admin.id, username: admin.username, name: admin.name, role: admin.role }}
    />
  );
}
