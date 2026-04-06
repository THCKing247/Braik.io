/**
 * Stable platform permission keys (mirrors public.platform_permissions.key).
 * Used for type-safe checks; the database is the source of truth for labels.
 */
export const PLATFORM_PERMISSION_KEYS = [
  "view_admin_portal",
  "manage_platform_settings",
  "manage_roles_permissions",
  "manage_users",
  "manage_organizations",
  "impersonate_users",
  "view_audit_logs",
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
  "export_roster",
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
  "message_players",
  "message_parents",
  "message_staff",
  "view_reports",
  "upload_documents",
  "manage_documents",
  "export_reports",
  "view_billing",
  "manage_billing",
  "view_ad_dashboard",
  "coach_view_access",
  "manage_team_settings",
  "manage_program_settings",
] as const

export type PlatformPermissionKey = (typeof PLATFORM_PERMISSION_KEYS)[number]

export function isPlatformPermissionKey(value: string): value is PlatformPermissionKey {
  return (PLATFORM_PERMISSION_KEYS as readonly string[]).includes(value)
}

/** Section order matches product spec groups */
export const PLATFORM_PERMISSION_SECTION_ORDER: string[] = [
  "Admin Portal",
  "Teams",
  "Rosters",
  "Playbooks",
  "Schedule / Calendar",
  "Messaging",
  "Reports / Documents",
  "Billing / Subscription",
  "Athletic Director / Coach Views",
]
