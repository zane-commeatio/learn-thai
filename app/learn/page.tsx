import type { Metadata } from "next";
import LearnerFeedClient from "./learner-feed-client";

export const metadata: Metadata = {
  title: "Learn Thai",
  description: "Mobile-first learner feed preview for published Thai clips.",
};

export default function LearnerPage() {
  return <LearnerFeedClient />;
}
