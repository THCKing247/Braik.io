import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { listSupabaseAuthUsers } from "@/lib/supabase/supabase-admin"

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
        const { data: memberships } = await supabase
          .from("team_members")
          .select("role, team_id")
          .eq("user_id", u.id)
        const teamIds = [...new Set((memberships ?? []).map((m) => m.team_id))]
        const teams =
          teamIds.length > 0
            ? await supabase.from("teams").select("id, name, org").in("id", teamIds)
            : { data: [] }
        return {
          ...u,
          memberships: (memberships ?? []).map((m) => {
            const team = (teams.data ?? []).find((t) => t.id === m.team_id)
            return {
              role: m.role,
              teamId: m.team_id,
              teamName: team?.name,
              organizationName: team?.org,
            }
          }),
        }
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
