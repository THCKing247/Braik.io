"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { TeamSettings } from "@/components/portal/team-settings"

const defaultTeam = {
  id: "",
  name: "Team",
  slogan: null as string | null,
  sport: "football",
  seasonName: "",
  seasonStart: new Date(),
  seasonEnd: new Date(),
  rosterCap: 0,
  duesAmount: 0,
  duesDueDate: null as Date | null,
  logoUrl: null as string | null,
  primaryColor: null as string | null,
  secondaryColor: null as string | null,
}

export default function SettingsPage() {
  return (
    <DashboardPageShell>
      {({ teamId }) => (
        <TeamSettings team={{ ...defaultTeam, id: teamId }} />
      )}
    </DashboardPageShell>
  )
}
