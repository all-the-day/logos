import type { Metadata } from "next";
import * as planService from "@/services/plan";
import * as checkinService from "@/services/checkin";
import * as cardDb from "@/db/card";
import * as verseDb from "@/db/verse";
import { getDailyVerse } from "@/lib/dailyverse";
import PlanClient from "./PlanClient";

export const metadata: Metadata = {
  title: "Logos - 背经",
};

export default async function PlanPage() {
  const planDetails = await planService.getActivePlanDetails();

  let progress = null;
  if (planDetails) {
    progress = await cardDb.getCardProgress(planDetails.plan.bookId);
  }

  const books = await verseDb.getAllBooks();
  const checkin = await checkinService.getCheckinStatus();
  const dailyVerse = await getDailyVerse();

  return (
    <PlanClient
      planDetails={JSON.parse(JSON.stringify(planDetails))}
      progress={JSON.parse(JSON.stringify(progress))}
      books={JSON.parse(JSON.stringify(books))}
      checkin={JSON.parse(JSON.stringify(checkin))}
      dailyVerse={JSON.parse(JSON.stringify(dailyVerse))}
    />
  );
}
