import { Calendar, Users, Megaphone, FileText, DollarSign, CreditCard, Package, UserPlus, MessageSquare, BookOpen } from "lucide-react"
import { LucideIcon } from "lucide-react"

export interface QuickAction {
  id: string
  href: string
  label: string
  icon: LucideIcon
  roles: string[]
}

// Quick Actions: Main navigation items in left sidebar
// Note: Platform Owner is a flag, not a role - Platform Owners see items based on their team role
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "roster",
    href: "/dashboard/roster",
    label: "Roster",
    icon: Users,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "schedule",
    href: "/dashboard/schedule",
    label: "Schedule",
    icon: Calendar,
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
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER"],
  },
  {
    id: "playbooks",
    href: "/dashboard/playbooks",
    label: "Playbooks",
    icon: BookOpen,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER"],
  },
  {
    id: "inventory",
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: Package,
    roles: ["HEAD_COACH", "ASSISTANT_COACH"],
  },
  {
    id: "announcements",
    href: "/dashboard/announcements",
    label: "Announcements",
    icon: Megaphone,
    roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"],
  },
  {
    id: "invites",
    href: "/dashboard/invites",
    label: "Invites",
    icon: UserPlus,
    roles: ["HEAD_COACH"],
  },
]

export function getQuickActionsForRole(role: string | undefined): QuickAction[] {
  if (!role) return []
  return QUICK_ACTIONS.filter((action) => action.roles.includes(role))
}
