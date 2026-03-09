"use client"

import { ComingSoon } from "@/components/portal/coming-soon"
import { Calendar } from "lucide-react"

export default function SchedulePage() {
  return (
    <ComingSoon
      title="Schedule"
      description="View and manage your full season schedule. Add games, practices, film sessions, and team events with reminders sent automatically."
      icon={Calendar}
    />
  )
}
