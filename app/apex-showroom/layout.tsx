import type { Metadata } from "next"
import type { ReactNode } from "react"

import { DemoFeedbackProvider } from "@/components/apex-showroom/demo-feedback"

export const metadata: Metadata = {
  title: "Apex Showroom — Interactive demo",
  description:
    "Explore interaction patterns, visual direction, and layout systems — a guided, client-ready demonstration environment powered by Apex Technical Solutions Group.",
  robots: "noindex, nofollow",
}

export default function ApexShowroomLayout({ children }: { children: ReactNode }) {
  return (
    <DemoFeedbackProvider>
      <div className="min-h-screen bg-[#030712] text-slate-100 antialiased">{children}</div>
    </DemoFeedbackProvider>
  )
}
