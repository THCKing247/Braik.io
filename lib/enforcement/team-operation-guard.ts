import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type TeamOperation = "write" | "ai" | "billing" | "view"

/**
 * When false, subscription_status and AI payment checks are skipped so all
 * teams have full write + AI access.  Flip to true at launch when billing
 * enforcement (Stripe) is integrated.
 */
const BILLING_ENFORCED = false

export class TeamOperationBlockedError extends Error {
  statusCode: number
  code: string
  details: Record<string, unknown>

  constructor(statusCode: number, code: string, message: string, details: Record<string, unknown>) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function toStructuredTeamAccessError(error: TeamOperationBlockedError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...error.details,
    },
  }
}

export async function requireTeamOperationAccess(
  teamId: string,
  operation: TeamOperation
): Promise<void> {
  const supabase = getSupabaseServer()
  let team: { id: string; team_status?: string; subscription_status?: string } | null = null
  let teamError: { message: string; code?: string } | null = null

  const { data: fullTeam, error: fullError } = await supabase
    .from("teams")
    .select("id, team_status, subscription_status, base_ai_credits")
    .eq("id", teamId)
    .maybeSingle()

  if (!fullError && fullTeam) {
    team = fullTeam
  } else if (fullError) {
    const msg = fullError.message ?? ""
    const code = (fullError as { code?: string }).code ?? ""
    // Missing column (e.g. team_status) from older migrations — fallback to id-only lookup
    const likelyMissingColumn =
      /column.*does not exist/i.test(msg) || code === "PGRST204" || /undefined_column/i.test(msg)
    if (likelyMissingColumn) {
      const { data: minimalTeam, error: minimalError } = await supabase
        .from("teams")
        .select("id")
        .eq("id", teamId)
        .maybeSingle()
      if (!minimalError && minimalTeam) {
        team = { id: minimalTeam.id, team_status: "active", subscription_status: "active" }
      } else {
        teamError = minimalError ?? fullError
      }
    } else {
      teamError = fullError
    }
  }

  // Debug: log raw lookup result (no extra filters; service role bypasses RLS)
  console.log("[requireTeamOperationAccess] team lookup", {
    teamId,
    teamIdLength: teamId?.length,
    operation,
    teamFound: !!team,
    hasError: !!teamError,
    errorMessage: teamError?.message ?? null,
    errorCode: teamError?.code ?? null,
  })

  if (teamError) {
    console.error("[requireTeamOperationAccess] teams query error", { teamId, operation, error: teamError })
    throw new TeamOperationBlockedError(
      500,
      "TEAM_LOOKUP_FAILED",
      "Team lookup failed",
      { teamId, operation, dbError: teamError.message }
    )
  }

  if (!team) {
    console.log("[requireTeamOperationAccess] team not found", { teamId, operation })
    throw new TeamOperationBlockedError(404, "TEAM_NOT_FOUND", "Team not found", { teamId, operation })
  }

  const t = team as {
    team_status?: string
    subscription_status?: string
    ai_enabled?: boolean
    ai_disabled_by_platform?: boolean
  }
  const teamStatus = t.team_status ?? "active"
  const subscriptionStatus = t.subscription_status ?? "active"

  // ── Billing enforcement (disabled in dev) ─────────────────────────────
  if (BILLING_ENFORCED) {
    if (subscriptionStatus === "terminated") {
      throw new TeamOperationBlockedError(
        423,
        "TEAM_SUBSCRIPTION_TERMINATED",
        "Team access is locked because the subscription is terminated.",
        {
          teamId: team.id,
          operation,
          teamStatus,
          subscriptionStatus,
        }
      )
    }
  }
  // ──────────────────────────────────────────────────────────────────────

  if (operation === "billing" || operation === "view") {
    return
  }

  // Admin suspension (non-payment): always enforced regardless of billing flag.
  if (teamStatus !== "active") {
    throw new TeamOperationBlockedError(
      403,
      "TEAM_SUSPENDED_WRITE_BLOCKED",
      "Team is suspended; write and AI operations are blocked.",
      {
        teamId: team.id,
        operation,
        teamStatus,
        subscriptionStatus,
      }
    )
  }

  // ── AI gating (disabled in dev) ────────────────────────────────────────
  if (BILLING_ENFORCED && operation === "ai") {
    const aiEnabled = t.ai_enabled ?? false
    const aiDisabledByPlatform = t.ai_disabled_by_platform ?? false
    if (!aiEnabled || aiDisabledByPlatform) {
      throw new TeamOperationBlockedError(
        403,
        "TEAM_AI_DISABLED",
        "AI execution is disabled for this team.",
        {
          teamId: team.id,
          operation,
          aiEnabled,
          aiDisabledByPlatform,
        }
      )
    }
  }
  // ──────────────────────────────────────────────────────────────────────
}
