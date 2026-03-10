import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

/**
 * PATCH /api/roster/codes/update?teamId=xxx
 * Updates team join codes.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage")

    const body = (await request.json()) as {
      playerCode?: string | null
      parentCode?: string | null
      teamIdCode?: string | null
    }

    const supabase = getSupabaseServer()

    // Check for uniqueness if codes are provided
    const updateData: { player_code?: string | null; parent_code?: string | null; team_id_code?: string | null } = {}

    if (body.playerCode !== undefined) {
      if (body.playerCode) {
        const { data: existing } = await supabase
          .from("teams")
          .select("id")
          .eq("player_code", body.playerCode)
          .neq("id", teamId)
          .maybeSingle()
        if (existing) {
          return NextResponse.json({ error: "Player code already in use" }, { status: 409 })
        }
      }
      updateData.player_code = body.playerCode || null
    }

    if (body.parentCode !== undefined) {
      if (body.parentCode) {
        const { data: existing } = await supabase
          .from("teams")
          .select("id")
          .eq("parent_code", body.parentCode)
          .neq("id", teamId)
          .maybeSingle()
        if (existing) {
          return NextResponse.json({ error: "Parent code already in use" }, { status: 409 })
        }
      }
      updateData.parent_code = body.parentCode || null
    }

    if (body.teamIdCode !== undefined) {
      if (body.teamIdCode) {
        const { data: existing } = await supabase
          .from("teams")
          .select("id")
          .eq("team_id_code", body.teamIdCode)
          .neq("id", teamId)
          .maybeSingle()
        if (existing) {
          return NextResponse.json({ error: "Team ID code already in use" }, { status: 409 })
        }
      }
      updateData.team_id_code = body.teamIdCode || null
    }

    const { error: updateError } = await supabase.from("teams").update(updateData).eq("id", teamId)

    if (updateError) {
      console.error("[PATCH /api/roster/codes/update]", updateError)
      return NextResponse.json({ error: "Failed to update codes" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[PATCH /api/roster/codes/update]", error)
  return NextResponse.json(
      { error: error.message || "Failed to update codes" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
  )
  }
}
