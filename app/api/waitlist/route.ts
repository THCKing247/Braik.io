import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { validateWaitlistPayload } from "@/lib/waitlist/submission"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = validateWaitlistPayload(json)
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: "validation", fieldErrors: parsed.errors },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      console.error("[waitlist] Supabase admin client unavailable")
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 })
    }

    const { data, error } = await supabase
      .from("waitlist_submissions")
      .insert({
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        email: parsed.data.email,
        role: parsed.data.role,
        organization_name: parsed.data.organizationName,
        message: parsed.data.message,
      })
      .select("id")
      .maybeSingle()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
      }
      console.error("[waitlist] insert error:", error.code, error.message)
      return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null }, { status: 201 })
  } catch (e) {
    console.error("[waitlist] unexpected:", e)
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 })
  }
}
