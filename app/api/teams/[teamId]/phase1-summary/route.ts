import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, MembershipLookupError } from "@/lib/auth/rbac"
import { canManageTeam } from "@/lib/auth/roles"
import { getRosterEntitlement, countActivePlayersForEntitlement } from "@/lib/billing/roster-entitlement"
import { isBillingLifecycleEnforced } from "@/lib/billing/billing-state"

/**
 * GET /api/teams/[teamId]/phase1-summary
 * Roster limits vs usage, billing enforcement flag, recent team-scoped audit entries (coach/admin visibility).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const membership = await getUserMembership(teamId)
    if (!membership || !canManageTeam(membership.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const ent = await getRosterEntitlement(supabase, teamId)
    const activeCount = await countActivePlayersForEntitlement(supabase, teamId, ent)
    const activePlayerCount = activeCount ?? null

    let recentAudit: Array<{
      action_type: string | null
      target_type: string | null
      target_id: string | null
      created_at: string
    }> = []

    try {
      const { data: rows } = await supabase
        .from("audit_logs")
        .select("action_type, target_type, target_id, created_at, metadata_json")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(15)

      if (rows?.length) {
        recentAudit = rows.map((r) => ({
          action_type: (r as { action_type?: string }).action_type ?? null,
          target_type: (r as { target_type?: string | null }).target_type ?? null,
          target_id: (r as { target_id?: string | null }).target_id ?? null,
          created_at: (r as { created_at: string }).created_at,
        }))
      } else {
        const { data: legacy } = await supabase
          .from("audit_logs")
          .select("action_type, action, target_type, target_id, created_at, metadata_json, metadata")
          .order("created_at", { ascending: false })
          .limit(40)

        const filtered = (legacy ?? []).filter((row: Record<string, unknown>) => {
          const meta = (row.metadata_json ?? row.metadata) as Record<string, unknown> | null | undefined
          const tid = meta && typeof meta === "object" && meta.teamId != null ? String(meta.teamId) : null
          return tid === teamId
        })
        recentAudit = filtered.slice(0, 15).map((r: Record<string, unknown>) => ({
          action_type: (r.action_type as string | null) ?? (r.action as string | null) ?? null,
          target_type: (r.target_type as string | null) ?? null,
          target_id: (r.target_id as string | null) ?? null,
          created_at: String(r.created_at ?? ""),
        }))
      }
    } catch (e) {
      console.warn("[phase1-summary] audit fetch soft-failed", e)
    }

    return NextResponse.json({
      roster: {
        scope: ent.scope,
        limit: ent.limit,
        programId: ent.programId,
        activePlayerCount,
        lookupFailed: ent.lookupFailed === true || activeCount === null,
      },
      billingLifecycleEnforced: isBillingLifecycleEnforced(),
      recentAudit,
    })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to load summary" }, { status: 500 })
    }
    console.error("[GET /api/teams/[teamId]/phase1-summary]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
