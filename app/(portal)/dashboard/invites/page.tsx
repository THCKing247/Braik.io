"use client"

import { ComingSoon } from "@/components/portal/coming-soon"
import { UserPlus } from "lucide-react"

export default function InvitesPage() {
  return (
    <ComingSoon
      title="Invite Team Members"
      description="Send invitations to players, coaches, and parents to join your team on Braik. Share your Team Code or send individual email invites."
      icon={UserPlus}
    />
  )
}
