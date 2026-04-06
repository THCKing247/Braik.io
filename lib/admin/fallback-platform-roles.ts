import type { PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"
import { PLATFORM_PERMISSION_KEYS, PLATFORM_PERMISSION_SECTION_ORDER } from "@/lib/permissions/platform-permission-keys"

/** Stable synthetic IDs for in-code catalog only (no DB row). */
export const FALLBACK_PLATFORM_ROLE_IDS = {
  platform_admin: "f0000001-0000-4000-8000-000000000001",
  athletic_director: "f0000001-0000-4000-8000-000000000002",
  head_coach: "f0000001-0000-4000-8000-000000000003",
  assistant_coach: "f0000001-0000-4000-8000-000000000004",
  team_staff: "f0000001-0000-4000-8000-000000000005",
  read_only: "f0000001-0000-4000-8000-000000000006",
} as const

const ALL_PERMISSION_KEYS: PlatformPermissionKey[] = [...PLATFORM_PERMISSION_KEYS]

/** Mirrors supabase/migrations/20260406000000_platform_roles_permissions.sql */
const KEYS_BY_ROLE: Record<(typeof FALLBACK_PLATFORM_ROLE_IDS)[keyof typeof FALLBACK_PLATFORM_ROLE_IDS], PlatformPermissionKey[]> = {
  [FALLBACK_PLATFORM_ROLE_IDS.platform_admin]: ALL_PERMISSION_KEYS,
  [FALLBACK_PLATFORM_ROLE_IDS.athletic_director]: [
    "view_admin_portal",
    "manage_organizations",
    "manage_users",
    "view_teams",
    "create_teams",
    "edit_teams",
    "delete_teams",
    "assign_team_staff",
    "view_roster",
    "create_players",
    "edit_players",
    "delete_players",
    "import_roster",
    "view_playbooks",
    "create_playbooks",
    "edit_playbooks",
    "delete_playbooks",
    "view_schedule",
    "create_schedule_events",
    "edit_schedule_events",
    "delete_schedule_events",
    "view_messages",
    "send_messages",
    "manage_message_templates",
    "view_reports",
    "upload_documents",
    "manage_documents",
    "view_billing",
    "view_ad_dashboard",
    "coach_view_access",
    "manage_team_settings",
  ],
  [FALLBACK_PLATFORM_ROLE_IDS.head_coach]: [
    "view_teams",
    "create_teams",
    "edit_teams",
    "delete_teams",
    "assign_team_staff",
    "view_roster",
    "create_players",
    "edit_players",
    "delete_players",
    "import_roster",
    "view_playbooks",
    "create_playbooks",
    "edit_playbooks",
    "delete_playbooks",
    "view_schedule",
    "create_schedule_events",
    "edit_schedule_events",
    "delete_schedule_events",
    "view_messages",
    "send_messages",
    "manage_message_templates",
    "view_reports",
    "upload_documents",
    "manage_documents",
    "view_billing",
    "coach_view_access",
    "manage_team_settings",
  ],
  [FALLBACK_PLATFORM_ROLE_IDS.assistant_coach]: [
    "view_teams",
    "edit_teams",
    "assign_team_staff",
    "view_roster",
    "create_players",
    "edit_players",
    "import_roster",
    "view_playbooks",
    "create_playbooks",
    "edit_playbooks",
    "view_schedule",
    "create_schedule_events",
    "edit_schedule_events",
    "view_messages",
    "send_messages",
    "view_reports",
    "upload_documents",
    "coach_view_access",
    "manage_team_settings",
  ],
  [FALLBACK_PLATFORM_ROLE_IDS.team_staff]: [
    "view_teams",
    "view_roster",
    "view_playbooks",
    "view_schedule",
    "view_messages",
    "send_messages",
    "view_reports",
    "coach_view_access",
  ],
  [FALLBACK_PLATFORM_ROLE_IDS.read_only]: [
    "view_teams",
    "view_roster",
    "view_playbooks",
    "view_schedule",
    "view_messages",
    "view_reports",
    "view_billing",
    "view_ad_dashboard",
  ],
}

export type PlatformRoleListItem = {
  id: string
  key: string
  name: string
  description: string | null
  role_type: string
  is_active: boolean
  is_deletable: boolean
  is_key_editable: boolean
  userCount: number
  permissionKeys: PlatformPermissionKey[]
}

export type FallbackPermissionGroup = {
  section: string
  keys: { key: PlatformPermissionKey; label: string }[]
}

/** Human-readable labels aligned with migration `platform_permissions` insert (short labels for UI). */
const KEY_LABELS: Partial<Record<PlatformPermissionKey, string>> = {
  view_admin_portal: "View admin portal",
  manage_platform_settings: "Manage platform settings",
  manage_roles_permissions: "Manage roles & permissions",
  manage_users: "Manage users",
  manage_organizations: "Manage organizations",
  view_teams: "View teams",
  create_teams: "Create teams",
  edit_teams: "Edit teams",
  delete_teams: "Delete teams",
  assign_team_staff: "Assign team staff",
  view_roster: "View roster",
  create_players: "Create players",
  edit_players: "Edit players",
  delete_players: "Delete players",
  import_roster: "Import roster",
  view_playbooks: "View playbooks",
  create_playbooks: "Create playbooks",
  edit_playbooks: "Edit playbooks",
  delete_playbooks: "Delete playbooks",
  view_schedule: "View schedule",
  create_schedule_events: "Create schedule events",
  edit_schedule_events: "Edit schedule events",
  delete_schedule_events: "Delete schedule events",
  view_messages: "View messages",
  send_messages: "Send messages",
  manage_message_templates: "Manage message templates",
  view_reports: "View reports",
  upload_documents: "Upload documents",
  manage_documents: "Manage documents",
  view_billing: "View billing",
  manage_billing: "Manage billing",
  view_ad_dashboard: "View AD dashboard",
  coach_view_access: "Coach view access",
  manage_team_settings: "Manage team settings",
}

/** Section → keys for admin UI (order matches product spec). */
const SECTION_KEYS: Record<string, PlatformPermissionKey[]> = {
  "Admin Portal": [
    "view_admin_portal",
    "manage_platform_settings",
    "manage_roles_permissions",
    "manage_users",
    "manage_organizations",
  ],
  Teams: ["view_teams", "create_teams", "edit_teams", "delete_teams", "assign_team_staff"],
  Rosters: ["view_roster", "create_players", "edit_players", "delete_players", "import_roster"],
  Playbooks: ["view_playbooks", "create_playbooks", "edit_playbooks", "delete_playbooks"],
  "Schedule / Calendar": [
    "view_schedule",
    "create_schedule_events",
    "edit_schedule_events",
    "delete_schedule_events",
  ],
  Messaging: ["view_messages", "send_messages", "manage_message_templates"],
  "Reports / Documents": ["view_reports", "upload_documents", "manage_documents"],
  "Billing / Subscription": ["view_billing", "manage_billing"],
  "Athletic Director / Coach Views": ["view_ad_dashboard", "coach_view_access", "manage_team_settings"],
}

export function getFallbackPlatformPermissionGroups(): FallbackPermissionGroup[] {
  return PLATFORM_PERMISSION_SECTION_ORDER.map((section) => {
    const keys = SECTION_KEYS[section] ?? []
    return {
      section,
      keys: keys.map((key) => ({
        key,
        label: KEY_LABELS[key] ?? key,
      })),
    }
  })
}

export function getFallbackPlatformRoles(): PlatformRoleListItem[] {
  const rows: PlatformRoleListItem[] = [
    {
      id: FALLBACK_PLATFORM_ROLE_IDS.platform_admin,
      key: "platform_admin",
      name: "Platform Admin",
      description: "Full platform access including admin portal management.",
      role_type: "system",
      is_active: true,
      is_deletable: false,
      is_key_editable: false,
      userCount: 0,
      permissionKeys: KEYS_BY_ROLE[FALLBACK_PLATFORM_ROLE_IDS.platform_admin],
    },
    {
      id: FALLBACK_PLATFORM_ROLE_IDS.athletic_director,
      key: "athletic_director",
      name: "Athletic Director",
      description: "Department-level access across teams, rosters, and schedules.",
      role_type: "system",
      is_active: true,
      is_deletable: false,
      is_key_editable: false,
      userCount: 0,
      permissionKeys: KEYS_BY_ROLE[FALLBACK_PLATFORM_ROLE_IDS.athletic_director],
    },
    {
      id: FALLBACK_PLATFORM_ROLE_IDS.head_coach,
      key: "head_coach",
      name: "Head Coach",
      description: "Team leadership: rosters, playbooks, schedule, and messaging.",
      role_type: "system",
      is_active: true,
      is_deletable: false,
      is_key_editable: false,
      userCount: 0,
      permissionKeys: KEYS_BY_ROLE[FALLBACK_PLATFORM_ROLE_IDS.head_coach],
    },
    {
      id: FALLBACK_PLATFORM_ROLE_IDS.assistant_coach,
      key: "assistant_coach",
      name: "Assistant Coach",
      description: "Coaching staff access with limited destructive actions.",
      role_type: "system",
      is_active: true,
      is_deletable: false,
      is_key_editable: false,
      userCount: 0,
      permissionKeys: KEYS_BY_ROLE[FALLBACK_PLATFORM_ROLE_IDS.assistant_coach],
    },
    {
      id: FALLBACK_PLATFORM_ROLE_IDS.team_staff,
      key: "team_staff",
      name: "Team Staff",
      description: "Operational access: view and communicate without full coaching controls.",
      role_type: "system",
      is_active: true,
      is_deletable: false,
      is_key_editable: false,
      userCount: 0,
      permissionKeys: KEYS_BY_ROLE[FALLBACK_PLATFORM_ROLE_IDS.team_staff],
    },
    {
      id: FALLBACK_PLATFORM_ROLE_IDS.read_only,
      key: "read_only",
      name: "Read Only",
      description: "View-only access to permitted areas.",
      role_type: "system",
      is_active: true,
      is_deletable: false,
      is_key_editable: false,
      userCount: 0,
      permissionKeys: KEYS_BY_ROLE[FALLBACK_PLATFORM_ROLE_IDS.read_only],
    },
  ]
  return rows
}
