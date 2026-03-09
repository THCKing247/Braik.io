"use client"

import { ComingSoon } from "@/components/portal/coming-soon"
import { Users } from "lucide-react"

export default function RosterPage() {
  return (
    <ComingSoon
      title="Roster Management"
      description="Add and manage players, coaches, and staff. Assign positions, track eligibility, and keep your team organized — all in one place."
      icon={Users}
    />
  )
}
