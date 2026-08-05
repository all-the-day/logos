import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import * as reviewService from "@/services/review";
import { requireUser } from "@/lib/auth";
import ReviewClient from "./ReviewClient";

export const metadata: Metadata = {
  title: "复习 - Logos",
};

export default async function ReviewPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const cards = await reviewService.getReviewQueue(user.id);
  return <ReviewClient cards={JSON.parse(JSON.stringify(cards))} />;
}
