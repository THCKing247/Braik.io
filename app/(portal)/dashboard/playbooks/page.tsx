"use client"

import { ComingSoon } from "@/components/portal/coming-soon"
import { BookOpen } from "lucide-react"

export default function PlaybooksPage() {
  return (
    <ComingSoon
      title="Playbooks"
      description="Build and share digital playbooks. Create plays, assign formations, and give every player access to the game plan from any device."
      icon={BookOpen}
    />
  )
}
