import * as cardDb from "@/db/card";

export async function getReviewQueue() {
  return cardDb.getDueCards();
}
