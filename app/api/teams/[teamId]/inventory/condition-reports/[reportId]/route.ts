import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { canApproveInventoryConditionReports } from "@/lib/inventory-condition-permissions"
import { revalidateTeamInventory } from "@/lib/cache/lightweight-get-cache"

/**
 * PATCH /api/teams/[teamId]/inventory/condition-reports/[reportId]
 * Body: { action: "approve" | "dismiss", reviewNote?: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; reportId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, reportId } = await params
    if (!teamId || !reportId) {
      return NextResponse.json({ error: "teamId and reportId are required" }, { status: 400 })
    }

    await requireTeamAccessWithUser(teamId, session.user)
    const membership = await getUserMembership(teamId)
    if (!membership || !canApproveInventoryConditionReports(membership)) {
      return NextResponse.json({ error: "Only the primary head coach may review condition reports." }, { status: 403 })
    }

    const body = await request.json()
    const action = body.action === "approve" || body.action === "dismiss" ? body.action : null
    const reviewNote =
      typeof body.reviewNote === "string" ? body.reviewNote.trim().slice(0, 4000) : null

    if (!action) {
      return NextResponse.json({ error: "action must be approve or dismiss" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: rep, error: repErr } = await supabase
      .from("inventory_condition_reports")
      .select("id, team_id, item_id, status, reported_condition")
      .eq("id", reportId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (repErr || !rep) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const r = rep as {
      id: string
      status: string
      item_id: string
      reported_condition: string
    }

    if (r.status !== "pending") {
      return NextResponse.json({ error: "This report has already been reviewed." }, { status: 409 })
    }

    const now = new Date().toISOString()

    if (action === "approve") {
      const { error: itemUp } = await supabase
        .from("inventory_items")
        .update({ condition: r.reported_condition })
        .eq("id", r.item_id)
        .eq("team_id", teamId)

      if (itemUp) {
        console.error("[PATCH condition-report] item update", itemUp)
        return NextResponse.json({ error: "Failed to update item condition" }, { status: 500 })
      }

      const { error: upErr } = await supabase
        .from("inventory_condition_reports")
        .update({
          status: "approved",
          reviewed_by: session.user.id,
          review_note: reviewNote,
          reviewed_at: now,
        })
        .eq("id", reportId)

      if (upErr) {
        console.error("[PATCH condition-report]", upErr)
        return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
      }
    } else {
      const { error: upErr } = await supabase
        .from("inventory_condition_reports")
        .update({
          status: "dismissed",
          reviewed_by: session.user.id,
          review_note: reviewNote,
          reviewed_at: now,
        })
        .eq("id", reportId)

      if (upErr) {
        console.error("[PATCH condition-report] dismiss", upErr)
        return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
      }
    }

    revalidateTeamInventory(teamId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[PATCH condition-report]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
