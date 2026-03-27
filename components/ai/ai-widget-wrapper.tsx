"use client"

import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import { AIChatbotWidget } from "./ai-chatbot-widget"

export function AIWidgetWrapper() {
  const shell = useAppBootstrapOptional()
  const teamId = shell?.payload?.team.id ?? shell?.teamId ?? ""
  const role = shell?.payload?.user.role

  if (!teamId?.trim() || !role) {
    return null
  }

  if (!canUseCoachB(role as Role)) {
    return null
  }

  // Widget always renders - on mobile it shows as fixed-position floating button/chat on left
  // On desktop it renders at the bottom of the layout
  return (
    <AIChatbotWidget
      teamId={teamId}
      userRole={role}
      primaryColor="#1e3a5f"
    />
  )
}
