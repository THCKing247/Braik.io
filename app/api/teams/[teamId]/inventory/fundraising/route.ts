import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { ROLES } from "@/lib/auth/roles"

/**
 * GET — team coaches: budget + entries + payment refs for a season (default: current calendar year).
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

    const url = new URL(request.url)
    const seasonYear = Math.max(
      2000,
      parseInt(url.searchParams.get("seasonYear") || String(new Date().getFullYear()), 10) || new Date().getFullYear()
    )

    const supabase = getSupabaseServer()
    const [budgetRes, entriesRes, refsRes] = await Promise.all([
      supabase.from("fundraising_budget").select("*").eq("team_id", teamId).eq("season_year", seasonYear).maybeSingle(),
      supabase.from("fundraising_entries").select("*").eq("team_id", teamId).eq("season_year", seasonYear).order("received_date", { ascending: false }),
      supabase.from("fundraising_payment_refs").select("*").eq("team_id", teamId).order("sort_order", { ascending: true }),
    ])

    if (budgetRes.error) return NextResponse.json({ error: budgetRes.error.message }, { status: 500 })
    if (entriesRes.error) return NextResponse.json({ error: entriesRes.error.message }, { status: 500 })
    if (refsRes.error) return NextResponse.json({ error: refsRes.error.message }, { status: 500 })

    const membership = await getUserMembership(teamId)
    const canEdit = membership?.role === ROLES.HEAD_COACH

    return NextResponse.json({
      seasonYear,
      budget: budgetRes.data ?? null,
      entries: entriesRes.data ?? [],
      paymentRefs: refsRes.data ?? [],
      canEdit,
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
 * POST — body: { action, ... } — head coach writes only.
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
    if (!membership || membership.role !== ROLES.HEAD_COACH) {
      return NextResponse.json({ error: "Only the head coach can edit fundraising data." }, { status: 403 })
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

    if (action === "delete_payment_ref") {
      const id = String(body.id || "")
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
      const { error } = await supabase.from("fundraising_payment_refs").delete().eq("id", id).eq("team_id", teamId)
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
