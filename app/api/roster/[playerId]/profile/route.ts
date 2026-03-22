import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import {
  mapRowToProfile,
  validateDateOfBirth,
  filterBodyForPlayerSelfEdit,
  type DbPlayerRow,
  type AssignedEquipmentItemRow,
} from "@/lib/player-profile-api"
import type { PlayerProfileUpdateBody } from "@/types/player-profile"
import { logPlayerProfileActivity, PLAYER_PROFILE_ACTION_TYPES } from "@/lib/player-profile-activity"
import { assertCanAddActivePlayers } from "@/lib/billing/roster-entitlement"
import { isLinkedParentOfPlayer } from "@/lib/player-documents/access"
import { getRequestClientIp } from "@/lib/http/request-client-ip"

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
        "id, team_id, first_name, last_name, grade, jersey_number, position_group, status, notes, image_url, user_id, email, weight, height, health_status, preferred_name, secondary_position, graduation_year, date_of_birth, school, parent_guardian_contact, player_phone, sms_opt_in, sms_opt_in_at, address, emergency_contact, medical_notes, eligibility_status, role_depth_notes, season_stats, game_stats, practice_metrics, coach_notes, assigned_equipment, equipment_issue_return_notes, profile_tags, profile_notes, document_refs"
      )
      .eq("id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const row = player as DbPlayerRow
    const isOwnProfile = row.user_id === session.user.id
    const isParentViewer = await isLinkedParentOfPlayer(supabase, session.user.id, playerId)
    if (!isCoach && !isOwnProfile && !isParentViewer) {
      return NextResponse.json(
        { error: "You can only view your own profile." },
        { status: 403 }
      )
    }

    const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
    const { data: invItems } = await supabase
      .from("inventory_items")
      .select(
        "id, category, name, condition, status, notes, damage_report_text, damage_reported_at, damage_reported_by_player_id"
      )
      .eq("team_id", teamId)
      .eq("assigned_to_player_id", playerId)

    const assignedEquipmentItems: AssignedEquipmentItemRow[] = (invItems ?? []).map((i) => ({
      id: i.id,
      category: i.category ?? null,
      name: i.name ?? "",
      condition: i.condition ?? null,
      status: i.status ?? null,
      notes: i.notes ?? null,
      damage_report_text: i.damage_report_text ?? null,
      damage_reported_at: i.damage_reported_at ?? null,
      damage_reported_by_player_id: i.damage_reported_by_player_id ?? null,
    }))

    const profile = mapRowToProfile(
      row,
      (team as { name?: string } | null)?.name ?? null,
      assignedEquipmentItems
    )

    return NextResponse.json({
      profile,
      canEdit: isCoach || isOwnProfile,
      isOwnProfile,
      isParentViewer,
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
      .select("id, team_id, user_id, health_status, status")
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

    const bodyToUse = isCoach
      ? (body as Record<string, unknown>)
      : filterBodyForPlayerSelfEdit(body as Record<string, unknown>)

    const consentIp = getRequestClientIp(request)

    const updates: Record<string, unknown> = {}

    const prevRosterStatus = ((player as { status?: string }).status ?? "active") as string
    if (
      isCoach &&
      bodyToUse.activeStatus !== undefined &&
      (bodyToUse.activeStatus as string) === "active" &&
      prevRosterStatus !== "active"
    ) {
      const cap = await assertCanAddActivePlayers(supabase, teamId, 1)
      if (!cap.ok) {
        return NextResponse.json(
          {
            error: cap.message,
            code: "ROSTER_LIMIT_REACHED",
            limit: cap.limit,
            current: cap.current,
          },
          { status: 402 }
        )
      }
    }

    if (isCoach) {
      if (bodyToUse.firstName !== undefined) updates.first_name = (bodyToUse.firstName as string)?.trim() ?? null
      if (bodyToUse.lastName !== undefined) updates.last_name = (bodyToUse.lastName as string)?.trim() ?? null
      if (bodyToUse.jerseyNumber !== undefined) updates.jersey_number = bodyToUse.jerseyNumber ?? null
      if (bodyToUse.position !== undefined) updates.position_group = (bodyToUse.position as string)?.trim() ?? null
      if (bodyToUse.secondaryPosition !== undefined) updates.secondary_position = (bodyToUse.secondaryPosition as string)?.trim() ?? null
      if (bodyToUse.graduationYear !== undefined) updates.graduation_year = bodyToUse.graduationYear ?? null
      if (bodyToUse.height !== undefined) updates.height = (bodyToUse.height as string)?.trim() ?? null
      if (bodyToUse.weight !== undefined) updates.weight = bodyToUse.weight ?? null
      if (bodyToUse.dateOfBirth !== undefined) updates.date_of_birth = validateDateOfBirth(bodyToUse.dateOfBirth)
      if (bodyToUse.school !== undefined) updates.school = (bodyToUse.school as string)?.trim() ?? null
      if (bodyToUse.parentGuardianContact !== undefined) updates.parent_guardian_contact = (bodyToUse.parentGuardianContact as string)?.trim() ?? null
      if (bodyToUse.medicalNotes !== undefined) updates.medical_notes = (bodyToUse.medicalNotes as string)?.trim() ?? null
      if (bodyToUse.activeStatus !== undefined) updates.status = (bodyToUse.activeStatus as string) ?? "active"
      if (bodyToUse.healthStatus !== undefined) {
        const h = bodyToUse.healthStatus
        if (h === "active" || h === "injured" || h === "unavailable") {
          updates.health_status = h
        }
      }
      if (bodyToUse.eligibilityStatus !== undefined) updates.eligibility_status = (bodyToUse.eligibilityStatus as string)?.trim() ?? null
      if (bodyToUse.roleDepthNotes !== undefined) updates.role_depth_notes = (bodyToUse.roleDepthNotes as string)?.trim() ?? null
      if (bodyToUse.seasonStats !== undefined) updates.season_stats = bodyToUse.seasonStats ?? {}
      if (bodyToUse.gameStats !== undefined) updates.game_stats = bodyToUse.gameStats ?? []
      if (bodyToUse.practiceMetrics !== undefined) updates.practice_metrics = bodyToUse.practiceMetrics ?? {}
      if (bodyToUse.coachNotes !== undefined) updates.coach_notes = (bodyToUse.coachNotes as string)?.trim() ?? null
      if (bodyToUse.assignedEquipment !== undefined) updates.assigned_equipment = bodyToUse.assignedEquipment ?? {}
      if (bodyToUse.equipmentIssueReturnNotes !== undefined) updates.equipment_issue_return_notes = (bodyToUse.equipmentIssueReturnNotes as string)?.trim() ?? null
      if (bodyToUse.profileNotes !== undefined) updates.profile_notes = (bodyToUse.profileNotes as string)?.trim() ?? null
      if (bodyToUse.profileTags !== undefined) updates.profile_tags = Array.isArray(bodyToUse.profileTags) ? (bodyToUse.profileTags as unknown[]).filter((t): t is string => typeof t === "string") : []
      if (bodyToUse.notes !== undefined) updates.notes = (bodyToUse.notes as string)?.trim() ?? null
    }

    // Self-edit fields (both coach and player when editing own)
    if (bodyToUse.preferredName !== undefined) updates.preferred_name = (bodyToUse.preferredName as string)?.trim() ?? null
    if (bodyToUse.playerEmail !== undefined) updates.email = (bodyToUse.playerEmail as string)?.trim()?.toLowerCase() ?? null
    if (bodyToUse.playerPhone !== undefined) {
      const nextPhone = (bodyToUse.playerPhone as string)?.trim() ?? ""
      if (nextPhone) {
        const consent = bodyToUse.smsTransactionalOptIn === true
        if (!consent) {
          return NextResponse.json(
            {
              error:
                "To save a mobile number for SMS notifications, please confirm SMS consent below. You can review the Privacy Policy and Terms of Service for details.",
              code: "SMS_CONSENT_REQUIRED",
            },
            { status: 400 }
          )
        }
        updates.player_phone = nextPhone
        updates.sms_opt_in = true
        updates.sms_opt_in_at = new Date().toISOString()
        updates.sms_opt_in_method = "web_form"
        updates.sms_opt_in_ip = consentIp
        updates.sms_opt_in_source = "profile_update"
      } else {
        updates.player_phone = null
        updates.sms_opt_in = false
        updates.sms_opt_in_at = null
        updates.sms_opt_in_method = null
        updates.sms_opt_in_ip = null
        updates.sms_opt_in_source = null
      }
    }
    if (bodyToUse.address !== undefined) updates.address = (bodyToUse.address as string)?.trim() ?? null
    if (bodyToUse.emergencyContact !== undefined) updates.emergency_contact = (bodyToUse.emergencyContact as string)?.trim() ?? null

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
      .select(
        "id, category, name, condition, status, notes, damage_report_text, damage_reported_at, damage_reported_by_player_id"
      )
      .eq("team_id", teamId)
      .eq("assigned_to_player_id", playerId)

    const assignedEquipmentItems: AssignedEquipmentItemRow[] = (invItems ?? []).map((i) => ({
      id: i.id,
      category: i.category ?? null,
      name: i.name ?? "",
      condition: i.condition ?? null,
      status: i.status ?? null,
      notes: i.notes ?? null,
      damage_report_text: i.damage_report_text ?? null,
      damage_reported_at: i.damage_reported_at ?? null,
      damage_reported_by_player_id: i.damage_reported_by_player_id ?? null,
    }))

    const profile = mapRowToProfile(
      updated as DbPlayerRow,
      (team as { name?: string } | null)?.name ?? null,
      assignedEquipmentItems
    )

    const hadStats =
      bodyToUse.seasonStats !== undefined ||
      bodyToUse.gameStats !== undefined ||
      bodyToUse.practiceMetrics !== undefined
    const prevHealth = (player as { health_status?: string | null }).health_status ?? "active"
    const nextHealth = (updated as { health_status?: string | null }).health_status ?? prevHealth
    const healthChanged =
      isCoach &&
      bodyToUse.healthStatus !== undefined &&
      String(nextHealth) !== String(prevHealth)

    if (healthChanged) {
      await logPlayerProfileActivity({
        playerId,
        teamId,
        actorId: session.user.id,
        actionType: PLAYER_PROFILE_ACTION_TYPES.HEALTH_STATUS_UPDATED,
        targetType: "player",
        targetId: playerId,
        metadata: { healthStatus: nextHealth },
      })
    }

    const updateKeys = Object.keys(updates).filter((k) => k !== "updated_at")
    const nonHealthKeys = updateKeys.filter((k) => k !== "health_status")
    const shouldLogProfileOrStats =
      hadStats || (nonHealthKeys.length > 0 && !(healthChanged && updateKeys.length === 1))

    if (shouldLogProfileOrStats) {
      await logPlayerProfileActivity({
        playerId,
        teamId,
        actorId: session.user.id,
        actionType: hadStats ? PLAYER_PROFILE_ACTION_TYPES.STATS_UPDATED : PLAYER_PROFILE_ACTION_TYPES.PROFILE_UPDATED,
        targetType: "player",
        targetId: playerId,
        metadata: hadStats ? { updatedFields: ["stats"] } : {},
      })
    }

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
