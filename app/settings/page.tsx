import type { Metadata } from "next";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = {
  title: "设置 - Logos",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
