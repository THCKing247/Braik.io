import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { listSupabaseAuthUsers } from "@/lib/supabase/supabase-admin"
import { organizationNameFromProgramsEmbed } from "@/lib/teams/team-organization-name"

export async function GET(request: Request) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const { searchParams } = new URL(request.url)
    const source = (searchParams.get("source") || "supabase").toLowerCase()
    const limitParam = Number(searchParams.get("limit") || "100")
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 100

    if (source === "supabase") {
      const supabaseResult = await listSupabaseAuthUsers(limit)
      return NextResponse.json({
        source: "supabase",
        supabaseSynced: supabaseResult.synced,
        reason: supabaseResult.reason,
        users: supabaseResult.users.map((user) => ({
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at,
          emailConfirmedAt: user.email_confirmed_at,
          userMetadata: user.user_metadata,
          appMetadata: user.app_metadata,
        })),
      })
    }

    const supabase = getSupabaseServer()
    const { data: users } = await supabase
      .from("users")
      .select("id, email, name, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)

    const withMemberships = await Promise.all(
      (users ?? []).map(async (u) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, team_id")
          .eq("id", u.id)
          .maybeSingle()
        const teamIds = profile?.team_id ? [profile.team_id] : []
        type TeamMembershipRow = { id: string; name: string; programs?: unknown }
        let teamRows: TeamMembershipRow[] = []
        if (teamIds.length > 0) {
          const withOrg = await supabase
            .from("teams")
            .select("id, name, programs(organizations(name))")
            .in("id", teamIds)
          if (withOrg.error) {
            console.warn("[admin/users] teams embed failed:", withOrg.error.message)
            const plain = await supabase.from("teams").select("id, name").in("id", teamIds)
            teamRows = (plain.data ?? []) as TeamMembershipRow[]
          } else {
            teamRows = (withOrg.data ?? []) as TeamMembershipRow[]
          }
        }
        const tid = profile?.team_id ?? null
        const rowForTeam = tid ? teamRows.find((t) => t.id === tid) : undefined
        const memberships = tid
          ? [
              {
                role: profile?.role ?? "player",
                teamId: tid,
                teamName: rowForTeam?.name,
                organizationName: rowForTeam
                  ? organizationNameFromProgramsEmbed(rowForTeam.programs)
                  : undefined,
              },
            ]
          : []
        return { ...u, memberships }
      })
    )

    return NextResponse.json({
      source: "db",
      users: withMemberships,
    })
  } catch (error: unknown) {
    console.error("Admin users listing error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
