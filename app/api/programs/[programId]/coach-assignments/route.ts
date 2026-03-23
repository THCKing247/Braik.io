import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramStaffAdmin } from "@/lib/auth/rbac"

export const runtime = "nodejs"

const ASSIGNMENT_TYPES = [
  "varsity_head",
  "jv_head",
  "freshman_head",
  "offense_coordinator",
  "defense_coordinator",
  "special_teams_coordinator",
] as const

type AssignmentType = (typeof ASSIGNMENT_TYPES)[number]

async function userEligibleForProgramAssignment(
  supabase: SupabaseClient,
  programId: string,
  userId: string
): Promise<boolean> {
  const { data: pm } = await supabase
    .from("program_members")
    .select("role")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()

  if (pm) {
    const role = String((pm as { role?: string }).role || "")
    if (["assistant_coach", "head_coach", "director_of_football"].includes(role)) return true
  }

  const { data: teams } = await supabase.from("teams").select("id").eq("program_id", programId)
  const teamIds = (teams || []).map((t) => t.id as string)
  if (teamIds.length === 0) return false

  const { data: prof } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", userId)
    .maybeSingle()

  if (!prof?.team_id || !teamIds.includes(prof.team_id as string)) return false
  const r = String(prof.role || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
  return r === "assistant_coach" || r === "head_coach"
}

/**
 * GET /api/programs/[programId]/coach-assignments
 */
export async function GET(_request: Request, { params }: { params: { programId: string } }) {
  try {
    const { programId } = params
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    await requireProgramStaffAdmin(programId)

    const supabase = getSupabaseServer()
    const { data: rows, error } = await supabase
      .from("coach_assignments")
      .select("id, assignment_type, user_id, team_id")
      .eq("program_id", programId)

    if (error) {
      console.error("[GET coach-assignments]", error)
      return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 })
    }

    const userIds = [...new Set((rows || []).map((r) => (r as { user_id?: string }).user_id).filter(Boolean))] as string[]
    let names: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
      names = Object.fromEntries(
        (profiles || []).map((p) => {
          const row = p as { id: string; full_name?: string | null; email?: string | null }
          const label = (row.full_name || row.email || row.id).trim()
          return [row.id, label]
        })
      )
    }

    const assignments = (rows || []).map((r) => {
      const row = r as { assignment_type: string; user_id: string }
      return {
        assignmentType: row.assignment_type,
        userId: row.user_id,
        displayName: names[row.user_id] ?? null,
      }
    })

    return NextResponse.json({ assignments })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/programs/[programId]/coach-assignments
 * Body: { assignmentType, userId?: string | null } — null userId clears assignment.
 */
export async function PATCH(request: Request, { params }: { params: { programId: string } }) {
  try {
    const { programId } = params
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    await requireProgramStaffAdmin(programId)

    const body = (await request.json()) as { assignmentType?: string; userId?: string | null }
    const assignmentType = body.assignmentType as AssignmentType | undefined
    if (!assignmentType || !ASSIGNMENT_TYPES.includes(assignmentType)) {
      return NextResponse.json({ error: "Invalid assignmentType" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    if (body.userId == null || body.userId === "") {
      const { error: delErr } = await supabase
        .from("coach_assignments")
        .delete()
        .eq("program_id", programId)
        .eq("assignment_type", assignmentType)

      if (delErr) {
        console.error("[PATCH coach-assignments delete]", delErr)
        return NextResponse.json({ error: "Failed to clear assignment" }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    const userId = String(body.userId)
    const ok = await userEligibleForProgramAssignment(supabase, programId, userId)
    if (!ok) {
      return NextResponse.json(
        { error: "User must be a coach in this football program" },
        { status: 400 }
      )
    }

    const { error: upErr } = await supabase.from("coach_assignments").upsert(
      {
        program_id: programId,
        user_id: userId,
        assignment_type: assignmentType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "program_id,assignment_type" }
    )

    if (upErr) {
      console.error("[PATCH coach-assignments upsert]", upErr)
      return NextResponse.json({ error: "Failed to save assignment" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Access denied") ? 403 : 500 }
    )
  }
}
