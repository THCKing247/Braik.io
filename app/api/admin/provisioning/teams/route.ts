import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function GET() {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, org, program_id, video_clips_enabled, coach_b_plus_enabled")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ teams: data ?? [] })
}

export async function POST(request: Request) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  let body: {
    name?: string
    organizationId?: string
    programName?: string
    sport?: string
    video_clips_enabled?: boolean
    coach_b_plus_enabled?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const sport = typeof body.sport === "string" && body.sport.trim() ? body.sport.trim() : "football"
  const programName = typeof body.programName === "string" && body.programName.trim() ? body.programName.trim() : name
  const orgId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""

  let programId: string | null = null
  let orgDisplay = name

  if (orgId) {
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle()
    if (orgErr || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 })
    }
    orgDisplay = org.name ?? name

    const { data: prog, error: progErr } = await supabase
      .from("programs")
      .insert({
        organization_id: org.id,
        program_name: programName,
        sport,
        plan_type: "head_coach",
      })
      .select("id")
      .maybeSingle()

    if (progErr || !prog?.id) {
      return NextResponse.json({ error: progErr?.message ?? "Failed to create program" }, { status: 500 })
    }
    programId = prog.id
  }

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({
      name,
      org: orgDisplay,
      program_id: programId,
      video_clips_enabled: body.video_clips_enabled === true,
      coach_b_plus_enabled: body.coach_b_plus_enabled === true,
    })
    .select("id, name, org, program_id, video_clips_enabled, coach_b_plus_enabled")
    .maybeSingle()

  if (teamErr || !team) {
    return NextResponse.json({ error: teamErr?.message ?? "Failed to create team" }, { status: 500 })
  }

  return NextResponse.json(team)
}

export const runtime = "nodejs"
