"use client"

import { MarketingFaq, type MarketingFaqItem } from "@/components/marketing/marketing-faq"

const PRICING_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: "What determines the price?",
    a: (
      <div className="space-y-3">
        <p>Your pricing depends on:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Number of players</li>
          <li>Number of teams</li>
          <li>Whether you add video</li>
          <li>Onboarding scope</li>
        </ul>
      </div>
    ),
  },
  {
    q: "Is onboarding required?",
    a: "No, but it’s recommended for a faster and smoother setup.",
  },
  {
    q: "Is onboarding a one-time fee?",
    a: "Yes. Onboarding is only charged once.",
  },
  {
    q: "Are assistant coaches extra?",
    a: "Additional coach access is low-cost at $25 per coach.",
  },
  {
    q: "Can we start with just one team?",
    a: "Yes. Many programs start with varsity and add more teams later.",
  },
  {
    q: "Do you offer enterprise pricing?",
    a: "Yes. We offer custom pricing for schools, departments, and larger rollouts.",
  },
]

export function PricingFaq() {
  return (
    <MarketingFaq
      title="Frequently asked questions"
      subtitle="Straight answers about Braik pricing and setup."
      items={PRICING_FAQ_ITEMS}
    />
  )
}
