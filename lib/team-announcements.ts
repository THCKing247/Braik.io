import { ROLES, type Role, canManageTeam } from "@/lib/auth/roles"

export type TeamAnnouncementAudience = "all" | "staff" | "players" | "parents"

export interface TeamAnnouncementRow {
  id: string
  team_id: string
  title: string
  body: string
  author_id: string
  author_name: string | null
  created_at: string
  updated_at: string
  is_pinned: boolean
  audience: string
  send_notification: boolean
}

const STAFF_ROLES: Role[] = [
  ROLES.HEAD_COACH,
  ROLES.ASSISTANT_COACH,
  ROLES.ATHLETIC_DIRECTOR,
  ROLES.SCHOOL_ADMIN,
]

export function userCanViewTeamAnnouncement(viewerRole: Role, audience: string): boolean {
  if (STAFF_ROLES.includes(viewerRole)) return true
  if (audience === "all") return true
  if (audience === "players" && viewerRole === ROLES.PLAYER) return true
  if (audience === "parents" && viewerRole === ROLES.PARENT) return true
  return false
}

export function userCanEditTeamAnnouncement(
  userId: string,
  viewerRole: Role,
  authorId: string
): boolean {
  if (userId === authorId) return true
  return canManageTeam(viewerRole)
}

export function sortTeamAnnouncements<T extends { is_pinned: boolean; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export const AUDIENCE_LABELS: Record<TeamAnnouncementAudience, string> = {
  all: "Everyone",
  staff: "Staff only",
  players: "Players",
  parents: "Parents",
}

export function formatAnnouncementDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    return `${date} · ${time}`
  } catch {
    return ""
  }
}
