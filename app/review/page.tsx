import * as reviewService from "@/services/review";
import ReviewClient from "./ReviewClient";

export default async function ReviewPage() {
  const cards = await reviewService.getReviewQueue();
  return <ReviewClient cards={JSON.parse(JSON.stringify(cards))} />;
}
