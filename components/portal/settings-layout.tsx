"use client"

import { useState, useCallback, useMemo, useEffect, type ComponentType } from "react"
import { Users, Calendar, Lock, ShieldCheck, UserCog, Building2, FileText } from "lucide-react"
import { TeamSettingsSection } from "./settings-sections/team-settings-section"
import { SeasonSettings } from "./settings-sections/season-settings"
import { CalendarSettingsSection } from "./settings-sections/calendar-settings-section"
import { PermissionsSettings } from "./settings-sections/permissions-settings"
import { ComplianceLegalSettings } from "./settings-sections/compliance-legal-settings"
import { RosterTemplateSettings } from "./settings-sections/roster-template-settings"
import { UsersListSettings } from "./settings-sections/users-list-settings"
import { LinkToOrganizationSettings } from "./settings-sections/link-to-organization-settings"
import { DocumentSettingsSection } from "./settings-sections/document-settings-section"

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
  icon: ComponentType<{ className?: string }>
  visible: (role: string) => boolean
}> = [
  { id: "team", label: "Team", icon: Users, visible: (role) => role === "HEAD_COACH" },
  { id: "season", label: "Season", icon: Calendar, visible: (role) => role === "HEAD_COACH" },
  { id: "calendar", label: "Calendar", icon: Calendar, visible: (role) => role === "HEAD_COACH" },
  { id: "permissions", label: "Roles", icon: Lock, visible: (role) => role === "HEAD_COACH" },
  { id: "rosterTemplate", label: "Roster Template", icon: Users, visible: (role) =>
    role === "HEAD_COACH" || role === "ASSISTANT_COACH",
  },
  { id: "documents", label: "Documents", icon: FileText, visible: (role) => role === "HEAD_COACH" },
  { id: "users", label: "Users", icon: UserCog, visible: (role) => role === "HEAD_COACH" },
  {
    id: "linkToOrganization",
    label: "Athletic Department",
    icon: Building2,
    visible: (role) => role === "HEAD_COACH",
  },
  { id: "compliance", label: "Compliance & Legal", icon: ShieldCheck, visible: (role) =>
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
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and team configuration</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left Navigation */}
        <div className="w-full shrink-0 lg:w-64">
          <nav className="flex flex-row gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {visibleSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-4 py-3 text-left transition-colors lg:w-full ${
                    isActive
                      ? "bg-primary text-primary-foreground border border-primary"
                      : "text-muted-foreground bg-transparent hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium">{section.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 min-w-0">
          <div className="rounded-lg border border-border bg-card p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
