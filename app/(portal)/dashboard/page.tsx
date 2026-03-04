"use client"

import { useSession } from "@/lib/auth/client-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ConnectToTeam } from "@/components/portal/connect-to-team"
import {
  Users,
  Calendar,
  MessageSquare,
  FileText,
  BookOpen,
  Package,
  Megaphone,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react"

const FEATURES = [
  {
    id: "roster",
    href: "/dashboard/roster",
    label: "Roster",
    description: "Manage your players, coaches, and staff",
    icon: Users,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "schedule",
    href: "/dashboard/schedule",
    label: "Schedule",
    description: "View and manage games, practices, and events",
    icon: Calendar,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "messages",
    href: "/dashboard/messages",
    label: "Messages",
    description: "Team-wide and direct messaging",
    icon: MessageSquare,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "documents",
    href: "/dashboard/documents",
    label: "Documents",
    description: "Waivers, forms, and team paperwork",
    icon: FileText,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "playbooks",
    href: "/dashboard/playbooks",
    label: "Playbooks",
    description: "Plays, formations, and game planning",
    icon: BookOpen,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER"],
  },
  {
    id: "inventory",
    href: "/dashboard/inventory",
    label: "Inventory",
    description: "Equipment tracking and uniform assignments",
    icon: Package,
    roles: ["HEAD_COACH", "ASSISTANT_COACH"],
  },
  {
    id: "announcements",
    href: "/dashboard/announcements",
    label: "Announcements",
    description: "Broadcast updates to your entire team",
    icon: Megaphone,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "invites",
    href: "/dashboard/invites",
    label: "Invite Members",
    description: "Add players, coaches, and parents to your team",
    icon: UserPlus,
    roles: ["HEAD_COACH"],
    highlight: true,
  },
]

function getRoleLabel(role?: string) {
  switch (role) {
    case "HEAD_COACH": return "Head Coach"
    case "ASSISTANT_COACH": return "Assistant Coach"
    case "PLAYER": return "Player"
    case "PARENT": return "Parent"
    default: return "Team Member"
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const role = session?.user?.role
  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "Coach"

  const visibleFeatures = FEATURES.filter((f) => !role || f.roles.includes(role))
  const isHeadCoach = role === "HEAD_COACH"
  const hasTeam = Boolean(session?.user?.teamId)

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
      </div>
    )
  }

  // Non-head-coach users who haven't entered a team code yet see the connect screen
  if (status === "authenticated" && !isHeadCoach && !hasTeam) {
    return <ConnectToTeam role={role || "PLAYER"} />
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">

      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>
            Welcome back, {name} 👋
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
            {getRoleLabel(role)} · Here&apos;s your team overview
          </p>
        </div>
        {isHeadCoach && (
          <Link href="/dashboard/invites">
            <Button
              className="flex items-center gap-2 text-white font-medium"
              style={{ backgroundColor: "rgb(var(--accent))" }}
            >
              <UserPlus className="h-4 w-4" />
              Invite Team Members
            </Button>
          </Link>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Roster", value: "0", icon: Users, note: "players" },
          { label: "Events", value: "0", icon: Calendar, note: "upcoming" },
          { label: "Messages", value: "0", icon: MessageSquare, note: "unread" },
          { label: "Documents", value: "0", icon: FileText, note: "pending" },
        ].map(({ label, value, icon: Icon, note }) => (
          <Card
            key={label}
            className="border"
            style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgb(var(--platinum))" }}
              >
                <Icon className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>{value}</p>
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  {label} · {note}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Getting Started (Head Coach only) */}
      {isHeadCoach && (
        <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: "rgb(var(--text))" }}>
              Getting Started Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Account created", done: true },
              { label: "Team created", done: true },
              { label: "Invite your first players & coaches", done: false, href: "/dashboard/invites" },
              { label: "Add your season schedule", done: false, href: "/dashboard/schedule" },
              { label: "Upload team documents", done: false, href: "/dashboard/documents" },
            ].map(({ label, done, href }) => (
              <div key={label} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: "rgb(var(--success))" }} />
                ) : (
                  <Clock className="h-5 w-5 flex-shrink-0" style={{ color: "rgb(var(--muted))" }} />
                )}
                {href && !done ? (
                  <Link
                    href={href}
                    className="text-sm font-medium hover:underline"
                    style={{ color: "rgb(var(--accent))" }}
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    className="text-sm"
                    style={{ color: done ? "rgb(var(--text))" : "rgb(var(--muted))" }}
                  >
                    {label}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Features Grid */}
      <div>
        <h2 className="mb-4 text-base font-semibold" style={{ color: "rgb(var(--text))" }}>
          Your Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleFeatures.map(({ id, href, label, description, icon: Icon, highlight }) => {
            // Features other than "Invite Members" are locked until the user has a team
            const isLocked = !isHeadCoach && !hasTeam && id !== "invites"
            const linkHref = isLocked ? "#" : href

            return (
              <Link
                key={id}
                href={linkHref}
                onClick={isLocked ? (e) => e.preventDefault() : undefined}
                className={`group block no-underline ${isLocked ? "cursor-default" : ""}`}
              >
                <Card
                  className="h-full border transition-all duration-200"
                  style={{
                    backgroundColor: isLocked ? "rgb(var(--platinum))" : highlight ? "rgb(var(--accent))" : "#FFFFFF",
                    borderColor: isLocked ? "rgb(var(--border))" : highlight ? "rgb(var(--accent))" : "rgb(var(--border))",
                    opacity: isLocked ? 0.65 : 1,
                  }}
                >
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: highlight && !isLocked
                            ? "rgba(255,255,255,0.2)"
                            : "rgb(var(--platinum))",
                        }}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={{ color: isLocked ? "rgb(var(--muted))" : highlight ? "#FFFFFF" : "rgb(var(--accent))" }}
                        />
                      </div>
                      {isLocked ? (
                        <Lock className="h-3.5 w-3.5" style={{ color: "rgb(var(--muted))" }} />
                      ) : (
                        <ArrowRight
                          className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: highlight ? "#FFFFFF" : "rgb(var(--muted))" }}
                        />
                      )}
                    </div>
                    <div>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: isLocked ? "rgb(var(--muted))" : highlight ? "#FFFFFF" : "rgb(var(--text))" }}
                      >
                        {label}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{
                          color: isLocked
                            ? "rgb(var(--muted))"
                            : highlight
                            ? "rgba(255,255,255,0.8)"
                            : "rgb(var(--muted))",
                        }}
                      >
                        {isLocked ? "Connect to a team to unlock" : description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
