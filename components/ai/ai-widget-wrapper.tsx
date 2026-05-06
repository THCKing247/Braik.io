"use client"

import dynamic from "next/dynamic"
import { useAppBootstrapCoreOptional } from "@/components/portal/app-bootstrap-context"
import { canUseCoachB, type Role } from "@/lib/auth/roles"

const AIChatbotWidget = dynamic(
  () => import("./ai-chatbot-widget").then((m) => m.AIChatbotWidget),
  { ssr: false }
)

export function AIWidgetWrapper() {
  const shell = useAppBootstrapCoreOptional()
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
