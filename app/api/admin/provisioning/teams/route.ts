import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { syncHeadCoachVideoViewPermissionForTeam } from "@/lib/video/sync-head-coach-video-permission"
import { organizationNameFromProgramsEmbed } from "@/lib/teams/team-organization-name"

const TEAMS_LIST_WITH_ORG =
  "id, name, program_id, video_clips_enabled, programs(organizations(name))"
const TEAMS_LIST_BASE = "id, name, program_id, video_clips_enabled"

export async function GET() {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const supabase = getSupabaseServer()
  const first = await supabase
    .from("teams")
    .select(TEAMS_LIST_WITH_ORG)
    .order("created_at", { ascending: false })
    .limit(200)

  const result =
    first.error != null
      ? await supabase
          .from("teams")
          .select(TEAMS_LIST_BASE)
          .order("created_at", { ascending: false })
          .limit(200)
      : first

  if (first.error != null) {
    console.warn("[provisioning/teams] GET embed failed:", first.error.message)
  }

  if (result.error) {
    console.warn("[provisioning/teams] GET failed:", result.error.message)
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const data = result.data ?? []
  const teams = data.map((t) => {
    const row = t as {
      id: string
      name: string
      program_id: string | null
      video_clips_enabled: boolean
      programs?: unknown
    }
    return {
      id: row.id,
      name: row.name,
      program_id: row.program_id,
      video_clips_enabled: row.video_clips_enabled,
      organizationName: organizationNameFromProgramsEmbed(row.programs),
    }
  })

  if (process.env.BRAIK_DEBUG_ADMIN_TEAMS === "1") {
    console.info("[provisioning/teams][debug] GET row count", teams.length)
  }

  return NextResponse.json({ teams })
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

  if (orgId) {
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle()
    if (orgErr || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 })
    }

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

  const { data: created, error: teamErr } = await supabase
    .from("teams")
    .insert({
      name,
      program_id: programId,
      video_clips_enabled: body.video_clips_enabled === true,
    })
    .select("id, name, program_id, video_clips_enabled")
    .maybeSingle()

  if (teamErr || !created) {
    console.warn("[provisioning/teams] POST insert failed:", teamErr?.message)
    return NextResponse.json({ error: teamErr?.message ?? "Failed to create team" }, { status: 500 })
  }

  const { data: enriched, error: enrichErr } = await supabase
    .from("teams")
    .select("programs(organizations(name))")
    .eq("id", created.id)
    .maybeSingle()

  if (enrichErr) {
    console.warn("[provisioning/teams] POST org embed failed:", enrichErr.message)
  }

  const payload = {
    id: created.id,
    name: created.name,
    program_id: created.program_id,
    video_clips_enabled: created.video_clips_enabled,
    organizationName: organizationNameFromProgramsEmbed(enriched?.programs),
  }

  if (body.video_clips_enabled === true) {
    try {
      await syncHeadCoachVideoViewPermissionForTeam(supabase, created.id)
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[video-perm-sync] after provision team", {
          teamId: created.id,
          err: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return NextResponse.json(payload)
}

export const runtime = "nodejs"
