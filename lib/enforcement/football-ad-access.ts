import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Football program ownership and Athletic Director portal access (Phase 1).
 * Computed from profiles, teams, programs, organizations, and athletic_departments — no separate cache column.
 */
export const FOOTBALL_AD_ACCESS_STATES = [
  "full_owner_ad",
  "restricted_football_ad",
  "team_head_coach_only",
  "assistant_only",
  "no_ad_access",
] as const

export type FootballAdAccessState = (typeof FOOTBALL_AD_ACCESS_STATES)[number]

export type FootballAdAccessContext = {
  state: FootballAdAccessState
  /** Varsity football program in scope for head-coach AD portal paths. */
  programId: string | null
  primaryTeamId: string | null
  /** Department license owner (auth user id) when an AD exists for the linked org. */
  departmentOwnerUserId: string | null
  /** True when this user is the row owner in athletic_departments. */
  isDepartmentAthleticDirector: boolean
}

function emptyContext(
  state: FootballAdAccessState,
  partial?: Partial<Pick<FootballAdAccessContext, "programId" | "primaryTeamId">>
): FootballAdAccessContext {
  return {
    state,
    programId: partial?.programId ?? null,
    primaryTeamId: partial?.primaryTeamId ?? null,
    departmentOwnerUserId: null,
    isDepartmentAthleticDirector: false,
  }
}

/** Football + legacy null/empty sport (treated as football for access). */
export function isFootballProgramSport(sport: string | null | undefined): boolean {
  const s = (sport ?? "").trim().toLowerCase()
  return s === "" || s === "football"
}

export function canAccessAdPortalRoutes(ctx: FootballAdAccessContext): boolean {
  return ctx.state === "full_owner_ad" || ctx.state === "restricted_football_ad"
}

/**
 * Department-level actions (e.g. org link codes, AD-scoped team creation) — only the licensed AD account.
 */
export function canPerformDepartmentOwnerActions(ctx: FootballAdAccessContext): boolean {
  return ctx.state === "full_owner_ad" && ctx.isDepartmentAthleticDirector
}

/** Phase 3: which AD top-nav tabs to render (filter only; same styles). */
export type AdPortalTabVisibility = {
  showOverview: boolean
  showTeams: boolean
  showCoaches: boolean
  showSettings: boolean
  /** Brand link target when Overview is unavailable. */
  homeHref: string
}

export function getAdPortalTabVisibility(ctx: FootballAdAccessContext): AdPortalTabVisibility {
  if (ctx.state === "restricted_football_ad") {
    return {
      showOverview: false,
      showTeams: true,
      showCoaches: true,
      showSettings: false,
      homeHref: "/dashboard/ad/teams",
    }
  }
  if (ctx.state === "full_owner_ad") {
    return {
      showOverview: true,
      showTeams: true,
      showCoaches: true,
      showSettings: true,
      homeHref: "/dashboard/ad",
    }
  }
  return {
    showOverview: false,
    showTeams: false,
    showCoaches: false,
    showSettings: false,
    homeHref: "/dashboard/ad/teams",
  }
}

async function isProgramOwner(
  supabase: SupabaseClient,
  userId: string,
  programId: string,
  createdByUserId: string | null
): Promise<boolean> {
  if (createdByUserId && createdByUserId === userId) return true
  const { data: row } = await supabase
    .from("program_members")
    .select("role")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .maybeSingle()
  const r = row ? String((row as { role: string }).role).toLowerCase().replace(/-/g, "_") : ""
  return r === "head_coach" || r === "athletic_director"
}

export type FootballAdAccessPrefetch = {
  /** When set (including null), skips profiles read for role/team_id. */
  prefetchedProfile?: { role?: string | null; team_id?: string | null } | null
  /**
   * When set (including null), skips `athletic_departments` lookup by athletic_director_user_id
   * (row where this user is the department AD).
   */
  prefetchedDirectorDept?: { id: string } | null
}

/**
 * Resolve football AD portal ownership/access for a user (legacy-safe).
 */
export async function resolveFootballAdAccessState(
  supabase: SupabaseClient,
  userId: string,
  prefetch?: FootballAdAccessPrefetch
): Promise<FootballAdAccessContext> {
  let profile: { role?: string | null; team_id?: string | null } | null
  if (prefetch?.prefetchedProfile !== undefined) {
    profile = prefetch.prefetchedProfile
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("role, team_id")
      .eq("id", userId)
      .maybeSingle()
    profile = data ?? null
  }

  const rawRole = (profile?.role ?? "player").toLowerCase().replace(/-/g, "_").replace(/ /g, "_")

  if (rawRole === "athletic_director") {
    let dept: { id?: string } | null
    if (prefetch?.prefetchedDirectorDept !== undefined) {
      dept = prefetch.prefetchedDirectorDept
    } else {
      const { data } = await supabase
        .from("athletic_departments")
        .select("id, athletic_director_user_id")
        .eq("athletic_director_user_id", userId)
        .maybeSingle()
      dept = data
    }
    if (dept?.id) {
      return {
        state: "full_owner_ad",
        programId: null,
        primaryTeamId: null,
        departmentOwnerUserId: userId,
        isDepartmentAthleticDirector: true,
      }
    }
    return emptyContext("no_ad_access")
  }

  if (rawRole === "assistant_coach") return emptyContext("assistant_only")
  if (rawRole === "player" || rawRole === "parent") return emptyContext("no_ad_access")
  if (rawRole !== "head_coach") return emptyContext("no_ad_access")

  const teamId = profile?.team_id as string | null
  if (!teamId) return emptyContext("no_ad_access")

  const { data: team } = await supabase
    .from("teams")
    .select("id, program_id, team_level")
    .eq("id", teamId)
    .maybeSingle()

  if (!team?.id) return emptyContext("no_ad_access")

  const levelRaw = (team as { team_level?: string | null }).team_level
  const level = (levelRaw ?? "varsity").toLowerCase()
  if (level === "jv" || level === "freshman") {
    return emptyContext("team_head_coach_only", { primaryTeamId: team.id })
  }

  const programId = (team as { program_id?: string | null }).program_id ?? null
  if (!programId) {
    return emptyContext("no_ad_access", { primaryTeamId: team.id })
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, organization_id, sport, created_by_user_id")
    .eq("id", programId)
    .maybeSingle()

  if (!program?.id) {
    return emptyContext("no_ad_access", { primaryTeamId: team.id })
  }

  const sport = (program as { sport?: string | null }).sport
  if (!isFootballProgramSport(sport)) {
    return {
      state: "team_head_coach_only",
      programId: program.id,
      primaryTeamId: team.id,
      departmentOwnerUserId: null,
      isDepartmentAthleticDirector: false,
    }
  }

  const orgId = (program as { organization_id?: string | null }).organization_id ?? null
  const createdBy = (program as { created_by_user_id?: string | null }).created_by_user_id ?? null

  if (!orgId) {
    const owner = await isProgramOwner(supabase, userId, program.id, createdBy)
    if (!owner) {
      return {
        state: "team_head_coach_only",
        programId: program.id,
        primaryTeamId: team.id,
        departmentOwnerUserId: null,
        isDepartmentAthleticDirector: false,
      }
    }
    return {
      state: "full_owner_ad",
      programId: program.id,
      primaryTeamId: team.id,
      departmentOwnerUserId: null,
      isDepartmentAthleticDirector: false,
    }
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, athletic_department_id")
    .eq("id", orgId)
    .maybeSingle()

  const deptLinkId = (org?.athletic_department_id as string | null) ?? null
  if (!deptLinkId) {
    const owner = await isProgramOwner(supabase, userId, program.id, createdBy)
    if (!owner) {
      return {
        state: "team_head_coach_only",
        programId: program.id,
        primaryTeamId: team.id,
        departmentOwnerUserId: null,
        isDepartmentAthleticDirector: false,
      }
    }
    return {
      state: "full_owner_ad",
      programId: program.id,
      primaryTeamId: team.id,
      departmentOwnerUserId: null,
      isDepartmentAthleticDirector: false,
    }
  }

  const { data: dept } = await supabase
    .from("athletic_departments")
    .select("athletic_director_user_id")
    .eq("id", deptLinkId)
    .maybeSingle()

  const adOwnerId = (dept?.athletic_director_user_id as string | null) ?? null
  if (!adOwnerId) {
    const owner = await isProgramOwner(supabase, userId, program.id, createdBy)
    if (!owner) {
      return {
        state: "team_head_coach_only",
        programId: program.id,
        primaryTeamId: team.id,
        departmentOwnerUserId: null,
        isDepartmentAthleticDirector: false,
      }
    }
    return {
      state: "full_owner_ad",
      programId: program.id,
      primaryTeamId: team.id,
      departmentOwnerUserId: null,
      isDepartmentAthleticDirector: false,
    }
  }

  return {
    state: "restricted_football_ad",
    programId: program.id,
    primaryTeamId: team.id,
    departmentOwnerUserId: adOwnerId,
    isDepartmentAthleticDirector: false,
  }
}
