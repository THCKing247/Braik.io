import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import {
  canSubmitInventoryConditionReport,
  canViewInventoryConditionReports,
} from "@/lib/inventory-condition-permissions"
import { revalidateTeamInventory } from "@/lib/cache/lightweight-get-cache"

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "NEEDS_REPLACEMENT"] as const

/**
 * GET /api/teams/[teamId]/inventory/condition-reports
 * Query: status=pending|all (default all for eligible viewers)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccessWithUser(teamId, session.user)
    const membership = await getUserMembership(teamId)
    if (!membership || !canViewInventoryConditionReports(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get("status") || "all"
    const supabase = getSupabaseServer()

    let q = supabase
      .from("inventory_condition_reports")
      .select(
        "id, item_id, reported_by, reported_condition, note, status, reviewed_by, review_note, created_at, reviewed_at"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(200)

    if (statusFilter === "pending") {
      q = q.eq("status", "pending")
    }

    const { data, error } = await q

    if (error) {
      console.error("[GET condition-reports]", error)
      return NextResponse.json({ error: "Failed to load reports" }, { status: 500 })
    }

    const itemIds = [...new Set((data ?? []).map((r) => (r as { item_id: string }).item_id))]
    const itemMeta = new Map<string, { name: string; inventory_bucket: string; equipment_type: string | null }>()
    if (itemIds.length) {
      const { data: items, error: itemErr } = await supabase
        .from("inventory_items")
        .select("id, name, inventory_bucket, equipment_type")
        .eq("team_id", teamId)
        .in("id", itemIds)
      if (!itemErr && items) {
        for (const it of items) {
          const row = it as {
            id: string
            name: string
            inventory_bucket: string
            equipment_type: string | null
          }
          itemMeta.set(row.id, {
            name: row.name,
            inventory_bucket: row.inventory_bucket,
            equipment_type: row.equipment_type,
          })
        }
      }
    }

    const reporterIds = [...new Set((data ?? []).map((r) => (r as { reported_by: string }).reported_by))]
    const reviewerIds = [
      ...new Set(
        (data ?? [])
          .map((r) => (r as { reviewed_by?: string | null }).reviewed_by)
          .filter(Boolean) as string[]
      ),
    ]
    const ids = [...new Set([...reporterIds, ...reviewerIds])]
    let names: Record<string, string> = {}
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
      for (const p of profs ?? []) {
        const row = p as { id: string; full_name?: string | null }
        names[row.id] = (row.full_name ?? "").trim() || "Coach"
      }
    }

    const rows = (data ?? []).map((raw) => {
      const r = raw as {
        id: string
        item_id: string
        reported_by: string
        reported_condition: string
        note: string | null
        status: string
        reviewed_by: string | null
        review_note: string | null
        created_at: string
        reviewed_at: string | null
      }
      const item = itemMeta.get(r.item_id)
      return {
        id: r.id,
        itemId: r.item_id,
        itemName: item?.name ?? "",
        inventoryBucket: item?.inventory_bucket ?? "",
        equipmentType: item?.equipment_type ?? "",
        reportedBy: r.reported_by,
        reportedByName: names[r.reported_by] ?? "Coach",
        reportedCondition: r.reported_condition,
        note: r.note,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedByName: r.reviewed_by ? names[r.reviewed_by] ?? "" : null,
        reviewNote: r.review_note,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      }
    })

    return NextResponse.json({ reports: rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET condition-reports]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/inventory/condition-reports
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccessWithUser(teamId, session.user)
    const membership = await getUserMembership(teamId)
    if (!membership || !canSubmitInventoryConditionReport(membership)) {
      return NextResponse.json({ error: "Only assistants and level heads may submit condition reports." }, { status: 403 })
    }

    const body = await request.json()
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : ""
    const reportedCondition =
      typeof body.reportedCondition === "string" ? body.reportedCondition.trim().toUpperCase() : ""
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : null

    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 })
    }
    if (!CONDITIONS.includes(reportedCondition as (typeof CONDITIONS)[number])) {
      return NextResponse.json({ error: "Invalid reportedCondition" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: item, error: itemErr } = await supabase
      .from("inventory_items")
      .select("id, team_id")
      .eq("id", itemId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (itemErr || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const { data: created, error: insErr } = await supabase
      .from("inventory_condition_reports")
      .insert({
        team_id: teamId,
        item_id: itemId,
        reported_by: session.user.id,
        reported_condition: reportedCondition,
        note,
        status: "pending",
      })
      .select("id")
      .single()

    if (insErr) {
      console.error("[POST condition-reports]", insErr)
      return NextResponse.json({ error: "Failed to submit report" }, { status: 500 })
    }

    revalidateTeamInventory(teamId)
    return NextResponse.json({ id: (created as { id: string }).id })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST condition-reports]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
