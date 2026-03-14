"use client"

import { useSession } from "@/lib/auth/client-auth"
import { AIChatbotWidget } from "./ai-chatbot-widget"

export function AIWidgetWrapper() {
  const { data: session } = useSession()

  if (!session?.user?.teamId || !session?.user?.role) {
    return null
  }

  return (
    <div className="min-h-0 flex-shrink-0">
      <AIChatbotWidget
        teamId={session.user.teamId}
        userRole={session.user.role}
        primaryColor="#1e3a5f"
      />
    </div>
  )
}
