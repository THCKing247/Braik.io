import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function GET() {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  console.info("[admin] GET /api/admin/provisioning/teams: listing teams (no teams.org)")
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, organization_id, program_id, video_clips_enabled, coach_b_plus_enabled")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const rows = data ?? []
  const orgIds = [...new Set(rows.map((t) => (t as { organization_id?: string | null }).organization_id).filter(Boolean))]
  let orgNameById = new Map<string, string>()
  if (orgIds.length > 0) {
    const { data: orgRows } = await supabase.from("organizations").select("id, name").in("id", orgIds)
    orgNameById = new Map((orgRows ?? []).map((o) => [(o as { id: string }).id, String((o as { name?: string }).name ?? "")]))
  }
  const teams = rows.map((t) => {
    const row = t as {
      id: string
      name?: string | null
      organization_id?: string | null
      program_id?: string | null
      video_clips_enabled?: boolean | null
      coach_b_plus_enabled?: boolean | null
    }
    const oid = row.organization_id
    return {
      ...row,
      organization_name: oid ? orgNameById.get(oid) ?? null : null,
    }
  })
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
  const requestedOrgId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""

  let resolvedOrganizationId: string | null = null
  let programId: string | null = null
  let orgDisplay = name

  if (requestedOrgId) {
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", requestedOrgId)
      .maybeSingle()
    if (orgErr || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 })
    }
    resolvedOrganizationId = org.id as string
    orgDisplay = org.name ?? name
  } else {
    const { data: createdOrg, error: createdOrgErr } = await supabase
      .from("organizations")
      .insert({ name: programName })
      .select("id, name")
      .maybeSingle()

    if (createdOrgErr || !createdOrg?.id) {
      return NextResponse.json({ error: createdOrgErr?.message ?? "Failed to create organization" }, { status: 500 })
    }
    resolvedOrganizationId = createdOrg.id as string
    orgDisplay = (createdOrg.name as string) ?? name
  }

  const { data: prog, error: progErr } = await supabase
    .from("programs")
    .insert({
      organization_id: resolvedOrganizationId,
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

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({
      name,
      organization_id: resolvedOrganizationId,
      program_id: programId,
      video_clips_enabled: body.video_clips_enabled === true,
      coach_b_plus_enabled: body.coach_b_plus_enabled === true,
    })
    .select("id, name, organization_id, program_id, video_clips_enabled, coach_b_plus_enabled")
    .maybeSingle()

  if (teamErr || !team) {
    return NextResponse.json({ error: teamErr?.message ?? "Failed to create team" }, { status: 500 })
  }

  return NextResponse.json({
    ...team,
    organization_name: orgDisplay,
  })
}

export const runtime = "nodejs"
