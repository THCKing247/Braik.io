import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  try {
    const { event, metadata } = (await request.json()) as {
      event?: string
      metadata?: Record<string, unknown>
    }

    if (!event) {
      return NextResponse.json({ error: "Event is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    if (supabase) {
      // Best effort insert; keep analytics non-blocking for UX.
      const { error } = await supabase.from("marketing_events").insert({
        event_name: event,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      })
      if (error) {
        console.info("marketing_events insert skipped:", error.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("analytics track error:", error)
    return NextResponse.json({ ok: false, error: error?.message || "Internal server error" }, { status: 500 })
  }
}
