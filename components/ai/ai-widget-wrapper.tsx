"use client"

import { useSession } from "@/lib/auth/client-auth"
import { AIChatbotWidget } from "./ai-chatbot-widget"

export function AIWidgetWrapper() {
  const { data: session } = useSession()

  if (!session?.user?.teamId || !session?.user?.role) {
    return null
  }

  // Widget always renders - on mobile it shows as fixed-position floating button/chat on left
  // On desktop it renders at the bottom of the layout
  return (
    <AIChatbotWidget
      teamId={session.user.teamId}
      userRole={session.user.role}
      primaryColor="#1e3a5f"
    />
  )
}
