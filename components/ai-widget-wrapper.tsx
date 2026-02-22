"use client"

import { useSession } from "next-auth/react"
import { AIChatbotWidget } from "./ai-chatbot-widget"

export function AIWidgetWrapper() {
  const { data: session } = useSession()

  if (!session?.user?.teamId || !session?.user?.role) {
    return null
  }

  return (
    <AIChatbotWidget 
      teamId={session.user.teamId} 
      userRole={session.user.role} 
      primaryColor="#1e3a5f"
    />
  )
}
