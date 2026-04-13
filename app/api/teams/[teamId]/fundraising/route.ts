import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import {
  canEditFundraising,
  canViewFundraisingFinancials,
  canViewFundraisingPaymentRefs,
  isFundraisingModuleRole,
} from "@/lib/auth/fundraising-access"
import { ROLES } from "@/lib/auth/roles"
import { resolveDueCollectionRecipients } from "@/lib/fundraising/resolve-due-collection-recipients"
import { syncDueCollectionAggregateStatus } from "@/lib/fundraising/sync-due-collection-aggregate"

type RecentActivityRow = {
  kind: "budget" | "donation"
  label: string
  amount: number | null
  at: string
}

function buildRecentActivity(
  budget: {
    updated_at: string
    school_allocation: number | null
    season_year: number
  } | null,
  entries: { source_name: string; source_type: string; amount: number; created_at: string }[]
): RecentActivityRow[] {
  const rows: RecentActivityRow[] = []
  if (budget) {
    rows.push({
      kind: "budget",
      label: `Budget · season ${budget.season_year}`,
      amount:
        budget.school_allocation != null && !Number.isNaN(Number(budget.school_allocation))
          ? Number(budget.school_allocation)
          : null,
      at: budget.updated_at,
    })
  }
  for (const e of entries) {
    rows.push({
      kind: "donation",
      label: `${e.source_name} · ${String(e.source_type).replace(/_/g, " ")}`,
      amount: e.amount != null ? Number(e.amount) : null,
      at: e.created_at,
    })
  }
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return rows.slice(0, 5)
}

/**
 * GET — role-scoped: full financial payload for primary HC + AD; payment refs only for other coaches.
 */
export async function GET(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
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
    if (!membership || !isFundraisingModuleRole(membership)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const url = new URL(request.url)
    const seasonYear = Math.max(
      2000,
      parseInt(url.searchParams.get("seasonYear") || String(new Date().getFullYear()), 10) || new Date().getFullYear()
    )

    const supabase = getSupabaseServer()
    const financial = canViewFundraisingFinancials(membership)
    const paymentOnly = canViewFundraisingPaymentRefs(membership) && !financial

    if (paymentOnly) {
      const refsRes = await supabase
        .from("fundraising_payment_refs")
        .select("*")
        .eq("team_id", teamId)
        .order("sort_order", { ascending: true })
      if (refsRes.error) return NextResponse.json({ error: refsRes.error.message }, { status: 500 })
      return NextResponse.json({
        access: "payment_refs_only" as const,
        paymentRefs: refsRes.data ?? [],
        canEditPaymentRefs: false,
      })
    }

    const [budgetRes, entriesRes, refsRes, dueRes] = await Promise.all([
      supabase.from("fundraising_budget").select("*").eq("team_id", teamId).eq("season_year", seasonYear).maybeSingle(),
      supabase
        .from("fundraising_entries")
        .select("*")
        .eq("team_id", teamId)
        .eq("season_year", seasonYear)
        .order("received_date", { ascending: false }),
      supabase.from("fundraising_payment_refs").select("*").eq("team_id", teamId).order("sort_order", { ascending: true }),
      supabase
        .from("fundraising_due_collections")
        .select("*")
        .eq("team_id", teamId)
        .eq("season_year", seasonYear)
        .order("due_date", { ascending: true }),
    ])

    if (budgetRes.error) return NextResponse.json({ error: budgetRes.error.message }, { status: 500 })
    if (entriesRes.error) return NextResponse.json({ error: entriesRes.error.message }, { status: 500 })
    if (refsRes.error) return NextResponse.json({ error: refsRes.error.message }, { status: 500 })
    if (dueRes.error) return NextResponse.json({ error: dueRes.error.message }, { status: 500 })

    const dueRows = dueRes.data ?? []
    const collectionIds = dueRows.map((r) => (r as { id: string }).id).filter(Boolean)
    const countMap = new Map<string, { total: number; collected: number }>()
    if (collectionIds.length > 0) {
      const { data: statRows, error: statErr } = await supabase
        .from("fundraising_due_collection_recipients")
        .select("collection_id, contribution_status")
        .eq("team_id", teamId)
        .in("collection_id", collectionIds)
      if (statErr) return NextResponse.json({ error: statErr.message }, { status: 500 })
      for (const row of statRows ?? []) {
        const cid = String((row as { collection_id: string }).collection_id)
        const cur = countMap.get(cid) ?? { total: 0, collected: 0 }
        cur.total += 1
        if ((row as { contribution_status?: string }).contribution_status === "collected") cur.collected += 1
        countMap.set(cid, cur)
      }
    }

    const dueCollections = dueRows.map((row) => {
      const id = String((row as { id: string }).id)
      const c = countMap.get(id) ?? { total: 0, collected: 0 }
      return {
        ...row,
        total_targets: c.total,
        collected_count: c.collected,
        pending_count: Math.max(0, c.total - c.collected),
      }
    })

    const entries = entriesRes.data ?? []
    const budget = budgetRes.data ?? null
    const recentActivity = buildRecentActivity(
      budget
        ? {
            updated_at: String((budget as { updated_at?: string }).updated_at || new Date().toISOString()),
            school_allocation: (budget as { school_allocation?: unknown }).school_allocation as number | null,
            season_year: (budget as { season_year?: number }).season_year ?? seasonYear,
          }
        : null,
      entries.map((e) => ({
        source_name: String((e as { source_name?: string }).source_name ?? ""),
        source_type: String((e as { source_type?: string }).source_type ?? ""),
        amount: Number((e as { amount?: unknown }).amount) || 0,
        created_at: String((e as { created_at?: string }).created_at || ""),
      }))
    )

    const canEdit = canEditFundraising(membership)

    return NextResponse.json({
      access: "full" as const,
      seasonYear,
      budget,
      entries,
      paymentRefs: refsRes.data ?? [],
      dueCollections,
      recentActivity,
      canEdit,
      canEditPaymentRefs: canEdit,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[fundraising GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST — body: { action, ... } — primary head coach only (writes).
 */
export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
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
    if (!membership || membership.role === ROLES.ATHLETIC_DIRECTOR) {
      return NextResponse.json({ error: "Only the head coach can edit fundraising data." }, { status: 403 })
    }
    if (!canEditFundraising(membership)) {
      return NextResponse.json({ error: "Only the primary head coach can edit fundraising data." }, { status: 403 })
    }

    const body = await request.json()
    const action = typeof body.action === "string" ? body.action : ""
    const supabase = getSupabaseServer()

    if (action === "upsert_budget") {
      const seasonYear = Math.max(2000, parseInt(String(body.seasonYear), 10) || new Date().getFullYear())
      const row = {
        team_id: teamId,
        season_year: seasonYear,
        school_allocation: body.schoolAllocation != null ? Number(body.schoolAllocation) : null,
        goal_amount: body.goalAmount != null ? Number(body.goalAmount) : null,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        affiliate_url: typeof body.affiliateUrl === "string" ? body.affiliateUrl.trim() || null : null,
        affiliate_label: typeof body.affiliateLabel === "string" ? body.affiliateLabel.trim() || null : null,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from("fundraising_budget")
        .upsert(row, { onConflict: "team_id,season_year" } as never)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ budget: data })
    }

    if (action === "add_entry") {
      const seasonYear = Math.max(2000, parseInt(String(body.seasonYear), 10) || new Date().getFullYear())
      const { data, error } = await supabase
        .from("fundraising_entries")
        .insert({
          team_id: teamId,
          season_year: seasonYear,
          source_type: String(body.sourceType || "donation"),
          source_name: String(body.sourceName || "").trim() || "Anonymous",
          amount: Math.max(0, Number(body.amount) || 0),
          received_date: String(body.receivedDate || new Date().toISOString().slice(0, 10)),
          notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
          created_by: session.user.id,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ entry: data })
    }

    if (action === "update_entry") {
      const id = String(body.id || "")
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
      const patch: Record<string, unknown> = {}
      if (body.sourceType != null) patch.source_type = String(body.sourceType)
      if (body.sourceName != null) patch.source_name = String(body.sourceName).trim() || "Anonymous"
      if (body.amount != null) patch.amount = Math.max(0, Number(body.amount) || 0)
      if (body.receivedDate != null) patch.received_date = String(body.receivedDate)
      if (body.notes !== undefined) patch.notes = typeof body.notes === "string" ? body.notes.trim() || null : null
      if (body.seasonYear != null) patch.season_year = Math.max(2000, parseInt(String(body.seasonYear), 10))
      const { data, error } = await supabase
        .from("fundraising_entries")
        .update(patch)
        .eq("id", id)
        .eq("team_id", teamId)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ entry: data })
    }

    if (action === "delete_entry") {
      const id = String(body.id || "")
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
      const { error } = await supabase.from("fundraising_entries").delete().eq("id", id).eq("team_id", teamId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === "add_payment_ref") {
      const { data, error } = await supabase
        .from("fundraising_payment_refs")
        .insert({
          team_id: teamId,
          platform: String(body.platform || "other"),
          handle_or_url: String(body.handleOrUrl || "").trim(),
          display_label: typeof body.displayLabel === "string" ? body.displayLabel.trim() || null : null,
          sort_order: typeof body.sortOrder === "number" ? body.sortOrder : 0,
          created_by: session.user.id,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ref: data })
    }

    if (action === "update_payment_ref") {
      const id = String(body.id || "")
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
      const patch: Record<string, unknown> = {}
      if (body.platform != null) patch.platform = String(body.platform)
      if (body.handleOrUrl != null) patch.handle_or_url = String(body.handleOrUrl).trim()
      if (body.displayLabel !== undefined) patch.display_label = typeof body.displayLabel === "string" ? body.displayLabel.trim() || null : null
      if (body.sortOrder != null) patch.sort_order = Number(body.sortOrder)
      const { data, error } = await supabase
        .from("fundraising_payment_refs")
        .update(patch)
        .eq("id", id)
        .eq("team_id", teamId)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ref: data })
    }

    if (action === "delete_payment_ref") {
      const id = String(body.id || "")
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
      const { error } = await supabase.from("fundraising_payment_refs").delete().eq("id", id).eq("team_id", teamId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === "add_due_collection") {
      const seasonY = Math.max(2000, parseInt(String(body.seasonYear), 10) || new Date().getFullYear())
      const description = String(body.description ?? "").trim()
      if (!description) return NextResponse.json({ error: "description is required" }, { status: 400 })
      /** Total collection goal for the group; clients divide evenly by recipient count for display. */
      const amountDue = Math.max(0, Number(body.amountDue) || 0)
      const dueDate = String(body.dueDate || "").trim()
      if (!dueDate) return NextResponse.json({ error: "dueDate is required" }, { status: 400 })
      const targetAll = Boolean(body.targetAll)
      let targetAssistantCoaches = Boolean(body.targetAssistantCoaches)
      let targetPlayers = Boolean(body.targetPlayers)
      let targetParents = Boolean(body.targetParents)
      if (targetAll) {
        targetAssistantCoaches = false
        targetPlayers = false
        targetParents = false
      }
      const hasTargets =
        targetAll || targetAssistantCoaches || targetPlayers || targetParents
      if (!hasTargets) {
        return NextResponse.json({ error: "Select at least one recipient target." }, { status: 400 })
      }
      const statusRaw = String(body.status || "pending")
      const status =
        statusRaw === "completed" ? "completed" : statusRaw === "in_progress" ? "in_progress" : "pending"

      const { data, error } = await supabase
        .from("fundraising_due_collections")
        .insert({
          team_id: teamId,
          season_year: seasonY,
          description,
          amount_due: amountDue,
          due_date: dueDate,
          status,
          notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
          created_by: session.user.id,
          updated_at: new Date().toISOString(),
          target_all: targetAll,
          target_assistant_coaches: targetAll || targetAssistantCoaches,
          target_players: targetAll || targetPlayers,
          target_parents: targetAll || targetParents,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const collectionId = (data as { id: string }).id

      const resolved = await resolveDueCollectionRecipients(supabase, teamId, {
        targetAll,
        targetAssistantCoaches,
        targetPlayers,
        targetParents,
      })
      if (resolved.length > 0) {
        const { error: insErr } = await supabase.from("fundraising_due_collection_recipients").insert(
          resolved.map((r) => ({
            collection_id: collectionId,
            team_id: teamId,
            user_id: r.user_id,
            role_kind: r.role_kind,
            player_id: r.player_id,
            contribution_status: "pending",
            updated_at: new Date().toISOString(),
          }))
        )
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
      await syncDueCollectionAggregateStatus(supabase, collectionId)
      const { data: refreshed, error: refErr } = await supabase
        .from("fundraising_due_collections")
        .select("*")
        .eq("id", collectionId)
        .single()
      if (refErr) return NextResponse.json({ error: refErr.message }, { status: 500 })
      return NextResponse.json({ dueCollection: refreshed })
    }

    if (action === "update_due_collection") {
      const id = String(body.id || "")
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (body.description != null) patch.description = String(body.description).trim() || "—"
      if (body.amountDue != null) patch.amount_due = Math.max(0, Number(body.amountDue) || 0)
      if (body.dueDate != null) patch.due_date = String(body.dueDate)
      if (body.status != null) {
        const s = String(body.status)
        patch.status =
          s === "completed" ? "completed" : s === "in_progress" ? "in_progress" : "pending"
      }
      if (body.notes !== undefined) patch.notes = typeof body.notes === "string" ? body.notes.trim() || null : null
      const { data, error } = await supabase
        .from("fundraising_due_collections")
        .update(patch)
        .eq("id", id)
        .eq("team_id", teamId)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ dueCollection: data })
    }

    if (action === "update_due_recipient") {
      const collectionId = String(body.collectionId || "")
      const recipientId = String(body.recipientId || "")
      if (!collectionId || !recipientId) {
        return NextResponse.json({ error: "collectionId and recipientId are required" }, { status: 400 })
      }
      const contributionStatus =
        String(body.contributionStatus || "pending") === "collected" ? "collected" : "pending"
      const receivedNote =
        body.receivedNote !== undefined && typeof body.receivedNote === "string"
          ? body.receivedNote.trim() || null
          : undefined
      const patch: Record<string, unknown> = {
        contribution_status: contributionStatus,
        updated_at: new Date().toISOString(),
      }
      if (receivedNote !== undefined) patch.received_note = receivedNote
      const { error } = await supabase
        .from("fundraising_due_collection_recipients")
        .update(patch)
        .eq("id", recipientId)
        .eq("collection_id", collectionId)
        .eq("team_id", teamId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await syncDueCollectionAggregateStatus(supabase, collectionId)
      return NextResponse.json({ ok: true })
    }

    if (action === "delete_due_collection") {
      const id = String(body.id || "")
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
      const { error } = await supabase.from("fundraising_due_collections").delete().eq("id", id).eq("team_id", teamId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[fundraising POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
