import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import * as planService from "@/services/plan";
import * as checkinService from "@/services/checkin";
import * as cardDb from "@/db/card";
import * as verseDb from "@/db/verse";
import { getDailyVerse } from "@/lib/dailyverse";
import { requireUser } from "@/lib/auth";
import PlanClient from "./PlanClient";

export const metadata: Metadata = {
  title: "Logos - 背经",
};

export default async function PlanPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const planDetails = await planService.getActivePlanDetails(user.id);

  let progress = null;
  if (planDetails) {
    progress = await cardDb.getCardProgress(planDetails.plan.bookId, user.id);
  }

  const books = await verseDb.getAllBooks();
  const checkin = await checkinService.getCheckinStatus(user.id);
  const dailyVerse = await getDailyVerse();

  return (
    <PlanClient
      user={{ id: user.id, email: user.email, name: user.name, role: user.role }}
      planDetails={JSON.parse(JSON.stringify(planDetails))}
      progress={JSON.parse(JSON.stringify(progress))}
      books={JSON.parse(JSON.stringify(books))}
      checkin={JSON.parse(JSON.stringify(checkin))}
      dailyVerse={JSON.parse(JSON.stringify(dailyVerse))}
    />
  );
}
