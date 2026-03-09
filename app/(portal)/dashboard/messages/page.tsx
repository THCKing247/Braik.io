"use client"

import { ComingSoon } from "@/components/portal/coming-soon"
import { MessageSquare } from "lucide-react"

export default function MessagesPage() {
  return (
    <ComingSoon
      title="Messages"
      description="Direct and group messaging for your entire team. Send updates, share files, and keep everyone in the loop in real time."
      icon={MessageSquare}
    />
  )
}
