"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { TeamSettingsSection } from "./settings-sections/team-settings-section"
import { SeasonSettings } from "./settings-sections/season-settings"
import { CalendarSettingsSection } from "./settings-sections/calendar-settings-section"
import { PermissionsSettings } from "./settings-sections/permissions-settings"
import { ComplianceLegalSettings } from "./settings-sections/compliance-legal-settings"
import { RosterTemplateSettings } from "./settings-sections/roster-template-settings"
import { UsersListSettings } from "./settings-sections/users-list-settings"
import { LinkToOrganizationSettings } from "./settings-sections/link-to-organization-settings"
import { DocumentSettingsSection } from "./settings-sections/document-settings-section"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import { PortalStandardPageHeader, PortalStandardPageRoot } from "@/components/portal/portal-standard-page"

interface Team {
  id: string
  name: string
  slogan: string | null
  sport: string
  seasonName: string
  seasonStart: Date
  seasonEnd: Date
  rosterCap: number
  duesAmount: number
  duesDueDate: Date | null
  logoUrl: string | null
  organization: {
    name: string
  }
  calendarSettings: {
    id: string
    defaultView: string
    assistantsCanAddMeetings: boolean
    assistantsCanAddPractices: boolean
    assistantsCanEditNonlocked: boolean
  } | null
  players: Array<{ id: string }>
}

type SettingsSection =
  | "team"
  | "season"
  | "calendar"
  | "permissions"
  | "compliance"
  | "rosterTemplate"
  | "documents"
  | "users"
  | "linkToOrganization"

export type TeamUpdatePayload = Partial<Pick<Team, "name" | "slogan" | "logoUrl">> | Team

interface SettingsLayoutProps {
  team: Team
  userRole: string
}

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection
  label: string
  visible: (role: string) => boolean
}> = [
  { id: "team", label: "Team", visible: (role) => role === "HEAD_COACH" },
  { id: "season", label: "Season", visible: (role) => role === "HEAD_COACH" },
  { id: "calendar", label: "Calendar", visible: (role) => role === "HEAD_COACH" },
  { id: "permissions", label: "Roles", visible: (role) => role === "HEAD_COACH" },
  { id: "rosterTemplate", label: "Roster Template", visible: (role) =>
    role === "HEAD_COACH" || role === "ASSISTANT_COACH",
  },
  { id: "documents", label: "Documents", visible: (role) => role === "HEAD_COACH" },
  { id: "users", label: "Users", visible: (role) => role === "HEAD_COACH" },
  {
    id: "linkToOrganization",
    label: "Athletic Department",
    visible: (role) => role === "HEAD_COACH",
  },
  { id: "compliance", label: "Compliance & Legal", visible: (role) =>
    role === "HEAD_COACH" || role === "ASSISTANT_COACH",
  },
]

function defaultSectionForRole(role: string): SettingsSection {
  if (role === "HEAD_COACH") return "team"
  return "compliance"
}

export function SettingsLayout({ team: initialTeam, userRole }: SettingsLayoutProps) {
  const [team, setTeam] = useState<Team>(initialTeam)
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => defaultSectionForRole(userRole))

  const onTeamUpdated = useCallback((updates: TeamUpdatePayload) => {
    setTeam((prev) => ({ ...prev, ...updates }))
  }, [])

  const visibleSections = useMemo(
    () => SETTINGS_SECTIONS.filter((section) => section.visible(userRole)),
    [userRole]
  )

  const visibleIds = useMemo(() => new Set(visibleSections.map((s) => s.id)), [visibleSections])

  useEffect(() => {
    if (visibleIds.has(activeSection)) return
    const first = visibleSections[0]?.id
    if (first) setActiveSection(first)
  }, [activeSection, visibleIds, visibleSections])

  const renderContent = () => {
    switch (activeSection) {
      case "team":
        return <TeamSettingsSection team={team} onTeamUpdated={onTeamUpdated} />
      case "season":
        return <SeasonSettings team={team} />
      case "calendar":
        return <CalendarSettingsSection teamId={team.id} initialSettings={team.calendarSettings} />
      case "permissions":
        return <PermissionsSettings teamId={team.id} initialSettings={team.calendarSettings} />
      case "compliance":
        return <ComplianceLegalSettings teamId={team.id} userRole={userRole} />
      case "rosterTemplate":
        return <RosterTemplateSettings teamId={team.id} />
      case "documents":
        return <DocumentSettingsSection teamId={team.id} />
      case "users":
        return <UsersListSettings teamId={team.id} />
      case "linkToOrganization":
        return <LinkToOrganizationSettings />
      default:
        return <TeamSettingsSection team={team} onTeamUpdated={onTeamUpdated} />
    }
  }

  return (
    <PortalStandardPageRoot className="flex min-h-0 flex-1 flex-col !space-y-0 overflow-hidden pb-0">
      <div className="shrink-0 space-y-4 border-b border-[#E5E7EB] bg-[#f9fafb] pb-4 pt-0 lg:bg-[#f9fafb]">
        <PortalStandardPageHeader
          title="Settings"
          description="Manage your account and team configuration."
          className="border-0 pb-0"
        />
        <PortalUnderlineTabs
          emphasized
          ariaLabel="Settings sections"
          tabs={visibleSections.map((s) => ({ id: s.id, label: s.label }))}
          value={activeSection}
          onValueChange={(id) => setActiveSection(id as SettingsSection)}
        />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
        <div className="space-y-6 py-4">{renderContent()}</div>
      </main>
    </PortalStandardPageRoot>
  )
}
