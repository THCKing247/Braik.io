import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { resolveAnalyticsTeamContext } from "@/lib/analytics/resolve-team-context"

const CATEGORIES = new Set(["bug", "feature_request", "support_question", "general"])

/**
 * POST /api/feedback — authenticated users only; ties optional team context for triage.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as {
      category?: string
      subject?: string
      body?: string
      teamId?: string
      pagePath?: string
    } | null

    const category = typeof body?.category === "string" ? body.category.trim() : ""
    if (!CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    const text = typeof body?.body === "string" ? body.body.trim() : ""
    if (text.length < 8) {
      return NextResponse.json({ error: "Please add a bit more detail (at least 8 characters)." }, { status: 400 })
    }
    if (text.length > 12000) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400 })
    }

    const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 200) : null
    const teamId = typeof body?.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : null
    const pagePath = typeof body?.pagePath === "string" ? body.pagePath.trim().slice(0, 500) : null

    const admin = getSupabaseAdminClient()
    if (!admin) {
      return NextResponse.json({ error: "Feedback storage is not configured" }, { status: 503 })
    }

    const ctx = await resolveAnalyticsTeamContext(admin, teamId)

    const { data: inserted, error } = await admin
      .from("user_feedback")
      .insert({
        user_id: session.user.id,
        team_id: teamId,
        program_id: ctx.program_id,
        organization_id: ctx.organization_id,
        category,
        subject: subject || null,
        body: text,
        page_path: pagePath,
        user_role: session.user.role ? String(session.user.role).slice(0, 64) : null,
      })
      .select("id")
      .single()

    if (error) {
      console.error("[POST /api/feedback]", error)
      return NextResponse.json({ error: "Could not save feedback" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: inserted?.id })
  } catch (e) {
    console.error("[POST /api/feedback]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
