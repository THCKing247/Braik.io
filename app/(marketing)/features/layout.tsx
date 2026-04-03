import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Features | Braik",
  description:
    "Rosters, schedules, communication, documents, payments, and AI support for football programs—built into one platform.",
}

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children
}
