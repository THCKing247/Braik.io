import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

export const runtime = "nodejs"

/**
 * PATCH /api/teams/[teamId]/users/[userId]/coaching-structure
 * Updates coaching structure (coordinator role and/or position coach roles) for a user
 */
export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string; userId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, userId } = params
    if (!teamId || !userId) {
      return NextResponse.json({ error: "teamId and userId are required" }, { status: 400 })
    }

    // Only head coaches can update coaching structure
    await requireTeamPermission(teamId, "manage")

    const body = await request.json()
    const { coordinatorRole, positionCoachRoles } = body as {
      coordinatorRole?: string | null
      positionCoachRoles?: string[]
    }

    const supabase = getSupabaseServer()

    // Verify user is part of the team and is an assistant coach
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, team_id")
      .eq("id", userId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found or not part of this team" }, { status: 404 })
    }

    const userRole = (profile.role || "").toUpperCase()
    if (userRole !== "ASSISTANT_COACH" && userRole !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Coaching structure can only be assigned to assistant coaches" },
        { status: 400 }
      )
    }

    // Validate coordinator role
    if (coordinatorRole !== undefined) {
      const validCoordinatorRoles = [
        null,
        "offensive_coordinator",
        "defensive_coordinator",
        "special_teams_coordinator",
      ]
      if (!validCoordinatorRoles.includes(coordinatorRole)) {
        return NextResponse.json({ error: "Invalid coordinator role" }, { status: 400 })
      }

      // If setting a coordinator role, check if another user already has it
      if (coordinatorRole) {
        const { data: existingCoordinator } = await supabase
          .from("profiles")
          .select("id")
          .eq("team_id", teamId)
          .eq("coordinator_role", coordinatorRole)
          .neq("id", userId)
          .maybeSingle()

        if (existingCoordinator) {
          return NextResponse.json(
            { error: `Another coach already holds the ${coordinatorRole} role` },
            { status: 409 }
          )
        }
      }
    }

    // Validate position coach roles
    if (positionCoachRoles !== undefined) {
      const validPositionRoles = ["OL", "WR", "QB", "RB", "TE", "DB", "LB", "DL", "Snap", "Kick", "Punt"]
      const invalidRoles = positionCoachRoles.filter((role) => !validPositionRoles.includes(role))
      if (invalidRoles.length > 0) {
        return NextResponse.json(
          { error: `Invalid position coach roles: ${invalidRoles.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Update the profile
    const updateData: {
      coordinator_role?: string | null
      position_coach_roles?: string[]
    } = {}

    if (coordinatorRole !== undefined) {
      updateData.coordinator_role = coordinatorRole
    }

    if (positionCoachRoles !== undefined) {
      updateData.position_coach_roles = positionCoachRoles
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId)

    if (updateError) {
      console.error("[PATCH /api/teams/[teamId]/users/[userId]/coaching-structure]", updateError)
      return NextResponse.json({ error: "Failed to update coaching structure" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[PATCH /api/teams/[teamId]/users/[userId]/coaching-structure]", error)
    return NextResponse.json(
      { error: error.message || "Failed to update coaching structure" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
