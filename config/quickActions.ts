import {
  Calendar,
  CalendarDays,
  Users,
  User,
  FileText,
  Package,
  MessageSquare,
  BookOpen,
  Settings,
  Stethoscope,
  TrendingUp,
  CircleDollarSign,
  LifeBuoy,
  Dumbbell,
  GraduationCap,
  Video,
} from "lucide-react"
import { LucideIcon } from "lucide-react"

export interface QuickAction {
  id: string
  href: string
  label: string
  icon: LucideIcon
  roles: string[]
  /** When set, item is shown only if Game Video / Clips nav is enabled for this user/team. */
  requiresVideoClipsNav?: boolean
}

// Quick Actions: Main navigation items in left sidebar
// Note: Platform Owner is a flag, not a role - Platform Owners see items based on their team role
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "roster",
    href: "/dashboard/roster",
    label: "Roster",
    icon: Users,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT", "ATHLETIC_DIRECTOR", "SCHOOL_ADMIN"],
  },
  {
    id: "profile",
    href: "/dashboard/profile",
    label: "My Profile",
    icon: User,
    roles: ["PLAYER"],
  },
  {
    id: "calendar",
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: Calendar,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "schedule",
    href: "/dashboard/schedule",
    label: "Schedule",
    icon: CalendarDays,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "messages",
    href: "/dashboard/messages",
    label: "Messages",
    icon: MessageSquare,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "documents",
    href: "/dashboard/documents",
    label: "Documents",
    icon: FileText,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "game-video",
    href: "/dashboard/game-video",
    label: "Game Video / Clips",
    icon: Video,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT", "ATHLETIC_DIRECTOR", "SCHOOL_ADMIN"],
    requiresVideoClipsNav: true,
  },
  {
    id: "playbooks",
    href: "/dashboard/playbooks",
    label: "Playbooks",
    icon: BookOpen,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER"],
  },
  {
    id: "weight-room",
    href: "/dashboard/weight-room",
    label: "Weight room",
    icon: Dumbbell,
    roles: ["HEAD_COACH", "ASSISTANT_COACH"],
  },
  {
    id: "study-guides",
    href: "/dashboard/study-guides",
    label: "Study guides",
    icon: GraduationCap,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "inventory",
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: Package,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "SCHOOL_ADMIN"],
  },
  {
    id: "health",
    href: "/dashboard/health",
    label: "Injury Report",
    icon: Stethoscope,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR", "SCHOOL_ADMIN"],
  },
  {
    id: "stats",
    href: "/dashboard/stats",
    label: "Stats / Analytics",
    icon: TrendingUp,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR", "SCHOOL_ADMIN"],
  },
  {
    id: "fundraising",
    href: "/dashboard/fundraising",
    label: "Fundraising",
    icon: CircleDollarSign,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"],
  },
  {
    id: "support",
    href: "/dashboard/support",
    label: "Support",
    icon: LifeBuoy,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "settings",
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    roles: ["HEAD_COACH"],
  },
]

export function getQuickActionsForRole(
  role: string | undefined,
  opts?: { videoClipsNavVisible?: boolean }
): QuickAction[] {
  if (!role) return []
  return QUICK_ACTIONS.filter((action) => {
    if (!action.roles.includes(role)) return false
    if (action.requiresVideoClipsNav && !opts?.videoClipsNavVisible) return false
    return true
  })
}

/** Routes covered by mobile bottom tabs — omit from phone sheet to avoid duplication. */
export function isPrimaryMobileTabPath(href: string): boolean {
  return (
    href === "/dashboard" ||
    href.startsWith("/dashboard/roster") ||
    href.startsWith("/dashboard/calendar") ||
    href.startsWith("/dashboard/messages")
  )
}
