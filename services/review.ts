import * as cardDb from "@/db/card";

export async function getReviewQueue(userId: number) {
  return cardDb.getDueCards(userId);
}
