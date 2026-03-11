"use client"

import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { TeamSettings } from "@/components/portal/team-settings"
import { TeamCodeSettingsCard } from "@/components/portal/team-code-settings-card"

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
      {({ teamId, userRole }) => (
        <div
          className="min-h-[420px] overflow-y-auto overflow-x-hidden rounded-lg border border-[#E5E7EB] bg-white/50 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          aria-label="Settings content"
        >
          <div className="p-4 space-y-6">
            <TeamCodeSettingsCard teamId={teamId} isHeadCoach={userRole === "HEAD_COACH"} />
            <TeamSettings team={{ ...defaultTeam, id: teamId }} />
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}
