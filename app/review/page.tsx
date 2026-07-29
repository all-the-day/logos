import type { Metadata } from "next";
import * as reviewService from "@/services/review";
import ReviewClient from "./ReviewClient";

export const metadata: Metadata = {
  title: "复习 - Logos",
};

export default async function ReviewPage() {
  const cards = await reviewService.getReviewQueue();
  return <ReviewClient cards={JSON.parse(JSON.stringify(cards))} />;
}
