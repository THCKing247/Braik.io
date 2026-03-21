import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { getServerSession } from "@/lib/auth/server-auth"
import { resolveAnalyticsTeamContext } from "@/lib/analytics/resolve-team-context"
import { sanitizeAnalyticsMetadata } from "@/lib/analytics/sanitize-metadata"
import { inferEventCategory, type ProductEventCategory } from "@/lib/analytics/infer-event-category"

const MAX_EVENT_NAME_LEN = 128

function parseCategory(body: { eventCategory?: string } | null, event: string): ProductEventCategory {
  const raw = body?.eventCategory
  if (raw === "marketing" || raw === "product" || raw === "coach_b" || raw === "billing") {
    return raw
  }
  return inferEventCategory(event)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      event?: string
      metadata?: Record<string, unknown>
      eventCategory?: string
      teamId?: string
    } | null

    const event = typeof body?.event === "string" ? body.event.trim() : ""
    if (!event || event.length > MAX_EVENT_NAME_LEN) {
      return NextResponse.json({ error: "Event is required" }, { status: 400 })
    }

    const session = await getServerSession().catch(() => null)
    const userId = session?.user?.id ?? null
    const sessionRole = typeof session?.user?.role === "string" ? session.user.role : null

    const teamId = typeof body?.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : null
    const metadata = sanitizeAnalyticsMetadata(body?.metadata ?? {})
    const eventCategory = parseCategory(body, event)

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      const ctx = await resolveAnalyticsTeamContext(supabase, teamId)
      const { error } = await supabase.from("product_events").insert({
        event_name: event,
        event_category: eventCategory,
        organization_id: ctx.organization_id,
        program_id: ctx.program_id,
        team_id: teamId,
        user_id: userId,
        role: sessionRole ? String(sessionRole).slice(0, 64) : null,
        source: "client",
        metadata,
      })
      if (error) {
        console.info("product_events insert skipped:", error.message)
      }

      // Legacy marketing table (landing CTAs, pricing views) — best-effort duplicate for older dashboards.
      if (eventCategory === "marketing") {
        const { error: mErr } = await supabase.from("marketing_events").insert({
          event_name: event,
          metadata,
          created_at: new Date().toISOString(),
        })
        if (mErr) {
          console.info("marketing_events insert skipped:", mErr.message)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error("analytics track error:", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}
