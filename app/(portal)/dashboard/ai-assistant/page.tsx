import { ComingSoon } from "@/components/portal/coming-soon"
import { Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

export default function AiAssistantPage() {
  return (
    <ComingSoon
      title="Coach B"
      description="Your personal coaching intelligence. Get play suggestions, injury insights, performance analytics, and game-day prep powered by AI."
      icon={Sparkles}
    />
  )
}
