import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Optional DB-backed lookups using `v_braik_*` views (see migration `20260420180000_braik_route_id_mapping_views.sql`).
 * Mirrors ordinal logic in `organization-routes.ts`; use for diagnostics or batch SQL-friendly resolution.
 */

export type OrganizationRouteMapRow = {
  organization_portal_uuid: string
  short_org_id: string
  display_name: string | null
}

export type TeamRouteMapRow = {
  team_uuid: string
  team_name: string | null
  organization_portal_uuid: string
  short_org_id: string
  short_team_id: string
}

export async function lookupOrganizationRouteMapByPortalUuid(
  supabase: SupabaseClient,
  organizationPortalUuid: string
): Promise<OrganizationRouteMapRow | null> {
  const { data, error } = await supabase
    .from("v_braik_organization_route_map")
    .select("organization_portal_uuid, short_org_id, display_name")
    .eq("organization_portal_uuid", organizationPortalUuid)
    .maybeSingle()
  if (error) throw error
  return data as OrganizationRouteMapRow | null
}

export async function lookupOrganizationRouteMapByShortOrgId(
  supabase: SupabaseClient,
  shortOrgId: string
): Promise<OrganizationRouteMapRow | null> {
  const { data, error } = await supabase
    .from("v_braik_organization_route_map")
    .select("organization_portal_uuid, short_org_id, display_name")
    .eq("short_org_id", shortOrgId)
    .maybeSingle()
  if (error) throw error
  return data as OrganizationRouteMapRow | null
}

export async function lookupTeamRouteMapByTeamUuid(
  supabase: SupabaseClient,
  teamUuid: string
): Promise<TeamRouteMapRow | null> {
  const { data, error } = await supabase
    .from("v_braik_team_route_map")
    .select("team_uuid, team_name, organization_portal_uuid, short_org_id, short_team_id")
    .eq("team_uuid", teamUuid)
    .maybeSingle()
  if (error) throw error
  return data as TeamRouteMapRow | null
}

export async function lookupTeamRouteMapByShortIds(
  supabase: SupabaseClient,
  shortOrgId: string,
  shortTeamId: string
): Promise<TeamRouteMapRow | null> {
  const { data, error } = await supabase
    .from("v_braik_team_route_map")
    .select("team_uuid, team_name, organization_portal_uuid, short_org_id, short_team_id")
    .eq("short_org_id", shortOrgId)
    .eq("short_team_id", shortTeamId)
    .maybeSingle()
  if (error) throw error
  return data as TeamRouteMapRow | null
}

export type PlayerRouteMapRow = {
  player_uuid: string
  player_account_id: string
  team_uuid: string
  short_team_id: string
  short_org_id: string
  organization_portal_uuid: string
  team_name: string | null
}

export async function lookupPlayerRouteMapByPlayerUuid(
  supabase: SupabaseClient,
  playerUuid: string
): Promise<PlayerRouteMapRow | null> {
  const { data, error } = await supabase
    .from("v_braik_player_route_map")
    .select(
      "player_uuid, player_account_id, team_uuid, short_team_id, short_org_id, organization_portal_uuid, team_name"
    )
    .eq("player_uuid", playerUuid)
    .maybeSingle()
  if (error) throw error
  return data as PlayerRouteMapRow | null
}
