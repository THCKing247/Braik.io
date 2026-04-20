import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

/**
 * PATCH /api/roster/[playerAccountId]/forms — update player forms status
 * Used when coach marks forms as complete or selects missing forms
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playerAccountId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerAccountId: segment } = await params
    if (!segment) {
      return NextResponse.json({ error: "playerAccountId route segment is required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(null, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const { requireTeamPermission } = await import("@/lib/auth/rbac")
    const supabase = getSupabaseServer()

    const { data: player, error: fetchErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", resolvedPlayerId)
      .maybeSingle()

    if (fetchErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission(player.team_id, "edit_roster")

    const body = (await request.json()) as {
      formsComplete: boolean
      missingForms: string[]
    }

    if (typeof body.formsComplete !== "boolean") {
      return NextResponse.json({ error: "formsComplete must be a boolean" }, { status: 400 })
    }

    if (!Array.isArray(body.missingForms)) {
      return NextResponse.json({ error: "missingForms must be an array" }, { status: 400 })
    }

    // Validate form types
    const validFormTypes = [
      "Player Agreement",
      "Insurance",
      "Physical Exam",
      "Liability Agreement"
    ]
    const invalidForms = body.missingForms.filter(f => !validFormTypes.includes(f))
    if (invalidForms.length > 0) {
      return NextResponse.json({ 
        error: `Invalid form types: ${invalidForms.join(", ")}` 
      }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      forms_complete: body.formsComplete,
      missing_forms: body.missingForms,
    }

    const { data: updated, error } = await supabase
      .from("players")
      .update(updates)
      .eq("id", resolvedPlayerId)
      .select("id, forms_complete, missing_forms, health_status")
      .single()

    if (error) {
      console.error("[PATCH /api/roster/[playerAccountId]/forms]", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: updated.id,
      formsComplete: updated.forms_complete,
      missingForms: updated.missing_forms || [],
      healthStatus: updated.health_status,
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      console.error("[PATCH /api/roster/[playerAccountId]/forms] membership lookup failed (DB/schema)", err.message)
      return NextResponse.json({ error: "Failed to update forms" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[PATCH /api/roster/[playerAccountId]/forms]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
