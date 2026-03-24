import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Athletic Director portal governance (replaces separate “football program director” as the top shell).
 * - full_owner: real AD, department owner, or varsity HC with no external AD on linked orgs
 * - restricted_football: varsity HC under an org that has another user as athletic director
 */
export type AdPortalAccessMode = "none" | "full_owner" | "restricted_football"

export type AdPortalAccess = {
  mode: AdPortalAccessMode
  /** Football program ids for program_id-scoped team queries */
  footballProgramIds: string[]
  /** department = school/dept/org-linked teams; program_ids = teams in footballProgramIds only */
  teamQuery: "department" | "program_ids"
}

function isFootballSport(sport: string | null | undefined): boolean {
  const s = String(sport ?? "")
    .trim()
    .toLowerCase()
  return s === "" || s === "football"
}

async function athleticDirectorUserIdForOrganization(
  supabase: SupabaseClient,
  organizationId: string | null | undefined
): Promise<string | null> {
  if (!organizationId) return null
  const { data: org } = await supabase
    .from("organizations")
    .select("athletic_department_id")
    .eq("id", organizationId)
    .maybeSingle()
  const deptId = (org as { athletic_department_id?: string | null } | null)?.athletic_department_id
  if (!deptId) return null
  const { data: dept } = await supabase
    .from("athletic_departments")
    .select("athletic_director_user_id")
    .eq("id", deptId)
    .maybeSingle()
  return (dept as { athletic_director_user_id?: string | null } | null)?.athletic_director_user_id ?? null
}

export async function getAdPortalAccessForUser(
  supabase: SupabaseClient,
  userId: string,
  sessionRoleUpper: string | null | undefined
): Promise<AdPortalAccess> {
  const role = sessionRoleUpper?.toUpperCase() ?? ""

  if (role === "ATHLETIC_DIRECTOR") {
    return { mode: "full_owner", footballProgramIds: [], teamQuery: "department" }
  }

  const { data: myDept } = await supabase
    .from("athletic_departments")
    .select("id")
    .eq("athletic_director_user_id", userId)
    .maybeSingle()

  if (myDept && role === "HEAD_COACH") {
    return { mode: "full_owner", footballProgramIds: [], teamQuery: "department" }
  }

  if (role !== "HEAD_COACH") {
    return { mode: "none", footballProgramIds: [], teamQuery: "department" }
  }

  const { data: pmRows } = await supabase
    .from("program_members")
    .select("program_id")
    .eq("user_id", userId)
    .eq("active", true)
    .in("role", ["head_coach", "director_of_football"])

  const programIds = [...new Set((pmRows ?? []).map((r) => (r as { program_id: string }).program_id).filter(Boolean))]
  if (programIds.length === 0) {
    return { mode: "none", footballProgramIds: [], teamQuery: "department" }
  }

  const { data: programs } = await supabase
    .from("programs")
    .select("id, sport, organization_id")
    .in("id", programIds)

  const footballProgs = (programs ?? []).filter((p) => isFootballSport((p as { sport?: string }).sport))
  if (footballProgs.length === 0) {
    return { mode: "none", footballProgramIds: [], teamQuery: "department" }
  }

  const footballIds = footballProgs.map((p) => (p as { id: string }).id)

  let hasExternalAd = false
  for (const p of footballProgs) {
    const orgId = (p as { organization_id?: string | null }).organization_id
    const adUid = await athleticDirectorUserIdForOrganization(supabase, orgId ?? null)
    if (adUid && adUid !== userId) {
      hasExternalAd = true
      break
    }
  }

  if (hasExternalAd) {
    return { mode: "restricted_football", footballProgramIds: footballIds, teamQuery: "program_ids" }
  }

  return { mode: "full_owner", footballProgramIds: footballIds, teamQuery: "program_ids" }
}

export function adPortalShowsOverviewAndSettings(access: AdPortalAccess): boolean {
  return access.mode === "full_owner"
}
