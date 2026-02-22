"use client"

import { useState } from "react"
import { User, Users, Calendar, Lock, CreditCard, Palette, HelpCircle, Settings2 } from "lucide-react"
import { AccountSettings } from "./settings-sections/account-settings"
import { TeamSettingsSection } from "./settings-sections/team-settings-section"
import { SeasonSettings } from "./settings-sections/season-settings"
import { CalendarSettingsSection } from "./settings-sections/calendar-settings-section"
import { PermissionsSettings } from "./settings-sections/permissions-settings"
import { CardIntegrationSettings } from "./settings-sections/card-integration-settings"
import { AppearanceSettings } from "./settings-sections/appearance-settings"
import { SupportSettings } from "./settings-sections/support-settings"

interface User {
  id: string
  email: string
  name: string | null
  image: string | null
}

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
    compactView: boolean
  } | null
  players: Array<{ id: string }>
}

type SettingsSection = 
  | "account"
  | "team"
  | "season"
  | "calendar"
  | "permissions"
  | "cardIntegration"
  | "appearance"
  | "support"

interface SettingsLayoutProps {
  user: User
  team: Team
  userRole: string
}

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection
  label: string
  icon: any
  visible: (role: string) => boolean
}> = [
  { id: "account", label: "Account", icon: User, visible: () => true },
  { id: "team", label: "Team", icon: Users, visible: (role) => role === "HEAD_COACH" },
  { id: "season", label: "Season", icon: Calendar, visible: (role) => role === "HEAD_COACH" },
  { id: "calendar", label: "Calendar", icon: Calendar, visible: (role) => role === "HEAD_COACH" },
  { id: "permissions", label: "Permissions", icon: Lock, visible: (role) => role === "HEAD_COACH" },
  { id: "cardIntegration", label: "Card Integration", icon: CreditCard, visible: (role) => role === "HEAD_COACH" },
  { id: "appearance", label: "Appearance", icon: Palette, visible: () => true },
  { id: "support", label: "Support", icon: HelpCircle, visible: () => true },
]

export function SettingsLayout({ user, team, userRole }: SettingsLayoutProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account")

  const visibleSections = SETTINGS_SECTIONS.filter((section) =>
    section.visible(userRole)
  )

  const renderContent = () => {
    switch (activeSection) {
      case "account":
        return <AccountSettings user={user} />
      case "team":
        return <TeamSettingsSection team={team} />
      case "season":
        return <SeasonSettings team={team} />
      case "calendar":
        return <CalendarSettingsSection teamId={team.id} initialSettings={team.calendarSettings} />
      case "permissions":
        return <PermissionsSettings teamId={team.id} initialSettings={team.calendarSettings} />
      case "cardIntegration":
        return <CardIntegrationSettings teamId={team.id} />
      case "appearance":
        return <AppearanceSettings />
      case "support":
        return <SupportSettings />
      default:
        return <AccountSettings user={user} />
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-white">Settings</h1>
        <p className="text-white/80">Manage your account and team configuration</p>
      </div>

      <div className="flex gap-6">
        {/* Left Navigation */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {visibleSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-[#1e3a5f] text-white border border-[#3B82F6]"
                      : "text-white/70 hover:text-white hover:bg-white/5"
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
          <div className="bg-[#1e3a5f] rounded-lg border border-[#1e3a5f] p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
