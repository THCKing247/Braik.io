"use client"

import { ComingSoon } from "@/components/portal/coming-soon"
import { Sparkles } from "lucide-react"

export default function AiAssistantPage() {
  return (
    <ComingSoon
      title="Coach B"
      description="Your personal coaching intelligence. Get play suggestions, injury insights, performance analytics, and game-day prep powered by AI."
      icon={Sparkles}
    />
  )
}
