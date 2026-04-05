"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { SettingsLayout } from "@/components/portal/settings-layout"

type SettingsTeam = {
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
  organization: { name: string }
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

type BundleJson = {
  userProfile: {
    id: string
    email: string | null
    full_name: string | null
    role: string | null
  }
  teamData: {
    id: string
    name: string | null
    slogan: string | null
    sport: string | null
    season_name: string | null
    logo_url: string | null
  } | null
  calendarSettings: Record<string, unknown> & {
    id: string
    default_view?: string | null
    assistants_can_add_meetings?: boolean | null
    assistants_can_add_practices?: boolean | null
    assistants_can_edit_nonlocked?: boolean | null
    compact_view?: boolean | null
  } | null
  players: Array<{ id: string }> | null
  userRole: string
  needsOnboarding: boolean
}

const SETTINGS_BUNDLE_QUERY_KEY = ["settings-page-bundle"] as const

export function SettingsPageClient() {
  const router = useRouter()
  const q = useQuery({
    queryKey: SETTINGS_BUNDLE_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/me/settings-page-bundle", { credentials: "include" })
      if (res.status === 401) {
        router.replace("/login?callbackUrl=/dashboard/settings")
        throw new Error("Unauthorized")
      }
      if (!res.ok) throw new Error(String(res.status))
      return (await res.json()) as BundleJson
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  })

  useEffect(() => {
    if (q.data?.needsOnboarding) {
      router.replace("/onboarding")
    }
  }, [q.data, router])

  if (q.isError) {
    return <p className="text-muted-foreground">Could not load settings.</p>
  }
  if (q.isPending || !q.data) {
    return (
      <div className="space-y-4 animate-pulse p-6">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-96 rounded-lg bg-muted/60" />
      </div>
    )
  }

  const bundle = q.data

  if (bundle.needsOnboarding) {
    return (
      <div className="space-y-4 animate-pulse p-6">
        <div className="h-8 w-48 rounded bg-muted" />
      </div>
    )
  }

  const sessionUserEmail = bundle.userProfile.email ?? ""
  const user = {
    id: bundle.userProfile.id,
    email: sessionUserEmail,
    name: bundle.userProfile.full_name,
    image: null as null,
  }

  const { teamData, calendarSettings, players } = bundle

  let team: SettingsTeam = {
    id: "",
    name: "",
    slogan: null,
    sport: "football",
    seasonName: "",
    seasonStart: new Date(),
    seasonEnd: new Date(),
    rosterCap: 0,
    duesAmount: 0,
    duesDueDate: null,
    logoUrl: null,
    organization: { name: "" },
    calendarSettings: null,
    players: [],
  }

  if (teamData) {
    team = {
      id: teamData.id,
      name: teamData.name || "",
      slogan: teamData.slogan,
      sport: teamData.sport || "football",
      seasonName: teamData.season_name || "",
      seasonStart: new Date(),
      seasonEnd: new Date(),
      rosterCap: 0,
      duesAmount: 0,
      duesDueDate: null,
      logoUrl: teamData.logo_url,
      organization: { name: teamData.name || "" },
      calendarSettings: calendarSettings
        ? {
            id: calendarSettings.id,
            defaultView: (calendarSettings.default_view as string) || "week",
            assistantsCanAddMeetings: calendarSettings.assistants_can_add_meetings ?? true,
            assistantsCanAddPractices: calendarSettings.assistants_can_add_practices ?? false,
            assistantsCanEditNonlocked: calendarSettings.assistants_can_edit_nonlocked ?? false,
            compactView: calendarSettings.compact_view ?? false,
          }
        : null,
      players: players || [],
    }
  }

  return <SettingsLayout user={user} team={team} userRole={bundle.userRole} />
}
