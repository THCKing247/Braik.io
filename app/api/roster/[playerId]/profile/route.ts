import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"
import type { PlayerProfile, PlayerProfileUpdateBody } from "@/types/player-profile"

type DbPlayer = {
  id: string
  team_id: string
  first_name: string
  last_name: string
  grade: number | null
  jersey_number: number | null
  position_group: string | null
  status: string
  notes: string | null
  image_url: string | null
  user_id: string | null
  email: string | null
  weight: number | null
  height: string | null
  health_status?: string | null
  preferred_name?: string | null
  secondary_position?: string | null
  graduation_year?: number | null
  date_of_birth?: string | null
  school?: string | null
  parent_guardian_contact?: string | null
  player_phone?: string | null
  address?: string | null
  emergency_contact?: string | null
  medical_notes?: string | null
  eligibility_status?: string | null
  role_depth_notes?: string | null
  season_stats?: unknown
  game_stats?: unknown
  practice_metrics?: unknown
  coach_notes?: string | null
  assigned_equipment?: unknown
  equipment_issue_return_notes?: string | null
  profile_tags?: unknown
  profile_notes?: string | null
  document_refs?: unknown
}

function mapRowToProfile(row: DbPlayer, teamName: string | null, assignedEquipmentItems: { id: string; category: string | null; name: string; condition: string | null; status: string | null; notes: string | null }[]): PlayerProfile {
  const tags = Array.isArray(row.profile_tags) ? row.profile_tags : []
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: teamName ?? null,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    preferredName: row.preferred_name ?? null,
    jerseyNumber: row.jersey_number ?? null,
    position: row.position_group ?? null,
    secondaryPosition: row.secondary_position ?? null,
    graduationYear: row.graduation_year ?? null,
    height: row.height ?? null,
    weight: row.weight ?? null,
    dateOfBirth: row.date_of_birth != null ? String(row.date_of_birth) : null,
    school: row.school ?? null,
    parentGuardianContact: row.parent_guardian_contact ?? null,
    playerEmail: row.email ?? null,
    playerPhone: row.player_phone ?? null,
    address: row.address ?? null,
    emergencyContact: row.emergency_contact ?? null,
    medicalNotes: row.medical_notes ?? null,
    activeStatus: row.status ?? "active",
    roleDepthNotes: row.role_depth_notes ?? null,
    eligibilityStatus: row.eligibility_status ?? null,
    seasonStats: (row.season_stats as Record<string, unknown>) ?? {},
    gameStats: Array.isArray(row.game_stats) ? row.game_stats : [],
    practiceMetrics: (row.practice_metrics as Record<string, unknown>) ?? {},
    coachNotes: row.coach_notes ?? null,
    assignedItems: assignedEquipmentItems.map((i) => ({
      id: i.id,
      category: i.category ?? undefined,
      name: i.name ?? "",
      condition: i.condition ?? undefined,
      status: i.status ?? undefined,
      notes: i.notes ?? null,
    })),
    assignedEquipment: (row.assigned_equipment as Record<string, unknown>) ?? {},
    equipmentIssueReturnNotes: row.equipment_issue_return_notes ?? null,
    notes: row.notes ?? null,
    profileNotes: row.profile_notes ?? null,
    tags,
    documentRefs: Array.isArray(row.document_refs) ? row.document_refs : [],
    imageUrl: normalizePlayerImageUrl(row.image_url) ?? null,
    healthStatus: (row.health_status as "active" | "injured" | "unavailable") ?? "active",
    userId: row.user_id ?? null,
  }
}

/**
 * GET /api/roster/[playerId]/profile?teamId=xxx
 * Returns full player profile. Coach: any player on team. Player: only own profile (user_id = session user).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    const isCoach = membership ? canEditRoster(membership.role) : false

    const supabase = getSupabaseServer()

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select(
        "id, team_id, first_name, last_name, grade, jersey_number, position_group, status, notes, image_url, user_id, email, weight, height, health_status, preferred_name, secondary_position, graduation_year, date_of_birth, school, parent_guardian_contact, player_phone, address, emergency_contact, medical_notes, eligibility_status, role_depth_notes, season_stats, game_stats, practice_metrics, coach_notes, assigned_equipment, equipment_issue_return_notes, profile_tags, profile_notes, document_refs"
      )
      .eq("id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const row = player as DbPlayer
    if (!isCoach && row.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "You can only view your own profile." },
        { status: 403 }
      )
    }

    const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
    const { data: invItems } = await supabase
      .from("inventory_items")
      .select("id, category, name, condition, status, notes")
      .eq("team_id", teamId)
      .eq("assigned_to_player_id", playerId)

    const assignedEquipmentItems = (invItems ?? []).map((i) => ({
      id: i.id,
      category: i.category ?? null,
      name: i.name ?? "",
      condition: i.condition ?? null,
      status: i.status ?? null,
      notes: i.notes ?? null,
    }))

    const profile = mapRowToProfile(
      row,
      (team as { name?: string } | null)?.name ?? null,
      assignedEquipmentItems
    )

    return NextResponse.json({
      profile,
      canEdit: isCoach,
      isOwnProfile: row.user_id === session.user.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json(
        { error: "You don't have access to this team." },
        { status: 403 }
      )
    }
    console.error("[GET /api/roster/.../profile]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/roster/[playerId]/profile
 * Update profile. Coach: any field. Player: only self-edit fields and only on own profile.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const body = (await request.json()) as PlayerProfileUpdateBody
    const supabase = getSupabaseServer()
    const { data: player, error: fetchErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", playerId)
      .maybeSingle()

    if (fetchErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    const isCoach = membership ? canEditRoster(membership.role) : false

    const row = player as { user_id: string | null }
    if (!isCoach && row.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own profile." },
        { status: 403 }
      )
    }

    const updates: Record<string, unknown> = {}

    if (isCoach) {
      if (body.firstName !== undefined) updates.first_name = body.firstName?.trim() ?? null
      if (body.lastName !== undefined) updates.last_name = body.lastName?.trim() ?? null
      if (body.jerseyNumber !== undefined) updates.jersey_number = body.jerseyNumber ?? null
      if (body.position !== undefined) updates.position_group = body.position?.trim() ?? null
      if (body.secondaryPosition !== undefined) updates.secondary_position = body.secondaryPosition?.trim() ?? null
      if (body.graduationYear !== undefined) updates.graduation_year = body.graduationYear ?? null
      if (body.height !== undefined) updates.height = body.height?.trim() ?? null
      if (body.weight !== undefined) updates.weight = body.weight ?? null
      if (body.dateOfBirth !== undefined) updates.date_of_birth = body.dateOfBirth?.trim() || null
      if (body.school !== undefined) updates.school = body.school?.trim() ?? null
      if (body.parentGuardianContact !== undefined) updates.parent_guardian_contact = body.parentGuardianContact?.trim() ?? null
      if (body.medicalNotes !== undefined) updates.medical_notes = body.medicalNotes?.trim() ?? null
      if (body.activeStatus !== undefined) updates.status = body.activeStatus ?? "active"
      if (body.eligibilityStatus !== undefined) updates.eligibility_status = body.eligibilityStatus?.trim() ?? null
      if (body.roleDepthNotes !== undefined) updates.role_depth_notes = body.roleDepthNotes?.trim() ?? null
      if (body.seasonStats !== undefined) updates.season_stats = body.seasonStats ?? {}
      if (body.gameStats !== undefined) updates.game_stats = body.gameStats ?? []
      if (body.practiceMetrics !== undefined) updates.practice_metrics = body.practiceMetrics ?? {}
      if (body.coachNotes !== undefined) updates.coach_notes = body.coachNotes?.trim() ?? null
      if (body.assignedEquipment !== undefined) updates.assigned_equipment = body.assignedEquipment ?? {}
      if (body.equipmentIssueReturnNotes !== undefined) updates.equipment_issue_return_notes = body.equipmentIssueReturnNotes?.trim() ?? null
      if (body.profileNotes !== undefined) updates.profile_notes = body.profileNotes?.trim() ?? null
      if (body.profileTags !== undefined) updates.profile_tags = body.profileTags ?? []
      if (body.notes !== undefined) updates.notes = body.notes?.trim() ?? null
    }

    // Self-edit fields (both coach and player when editing own)
    if (body.preferredName !== undefined) updates.preferred_name = body.preferredName?.trim() ?? null
    if (body.playerEmail !== undefined) updates.email = body.playerEmail?.trim()?.toLowerCase() ?? null
    if (body.playerPhone !== undefined) updates.player_phone = body.playerPhone?.trim() ?? null
    if (body.address !== undefined) updates.address = body.address?.trim() ?? null
    if (body.emergencyContact !== undefined) updates.emergency_contact = body.emergencyContact?.trim() ?? null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: updated, error: updateErr } = await supabase
      .from("players")
      .update(updates)
      .eq("id", playerId)
      .select()
      .single()

    if (updateErr) {
      console.error("[PATCH /api/roster/.../profile]", updateErr.message)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
    const { data: invItems } = await supabase
      .from("inventory_items")
      .select("id, category, name, condition, status, notes")
      .eq("team_id", teamId)
      .eq("assigned_to_player_id", playerId)

    const profile = mapRowToProfile(
      updated as DbPlayer,
      (team as { name?: string } | null)?.name ?? null,
      (invItems ?? []).map((i) => ({
        id: i.id,
        category: i.category ?? null,
        name: i.name ?? "",
        condition: i.condition ?? null,
        status: i.status ?? null,
        notes: i.notes ?? null,
      }))
    )

    return NextResponse.json({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json(
        { error: "You don't have access to this team." },
        { status: 403 }
      )
    }
    console.error("[PATCH /api/roster/.../profile]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
