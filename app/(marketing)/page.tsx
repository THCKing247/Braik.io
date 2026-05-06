import type { Metadata } from "next"
import { MarketingHomeView } from "@/components/marketing/marketing-home-view"

export const metadata: Metadata = {
  title: "Braik - Break the Huddle. Break the Norm.",
  description:
    "Sports team operating system for roster, dues, comms, schedule, docs, and AI admin assistant.",
}

export default function HomePage() {
  return <MarketingHomeView />
}
