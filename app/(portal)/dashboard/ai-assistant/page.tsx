import { ComingSoon } from "@/components/portal/coming-soon"
import { Sparkles } from "lucide-react"

export default function AiAssistantPage() {
  return (
    <ComingSoon
      title="AI Assistant"
      description="Your personal coaching intelligence. Get play suggestions, injury insights, performance analytics, and game-day prep powered by AI."
      icon={Sparkles}
    />
  )
}
