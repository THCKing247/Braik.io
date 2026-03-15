import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { generateUniqueInviteCode } from "@/lib/invites/invite-codes"
import type { InviteCodeType } from "@/lib/invites/invite-codes"
import { getOrCreateAdOrganization } from "@/lib/ad-organization"

export const runtime = "nodejs"

const VALID_INVITE_TYPES: InviteCodeType[] = [
  "head_coach_team_invite",
  "assistant_coach_invite",
  "team_player_join",
  "player_claim_invite",
  "parent_link_invite",
  "athletic_director_link_invite",
]

/** Create a new typed invite code. Requires appropriate permission (head coach / AD for program/team). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      inviteType: InviteCodeType
      programId?: string
      teamId?: string
      targetPlayerId?: string
      organizationId?: string
      maxUses?: number
      expiresInDays?: number
      metadata?: Record<string, unknown>
    }

    const { inviteType, programId, teamId, targetPlayerId, organizationId: bodyOrgId, maxUses, expiresInDays, metadata } = body
    if (!inviteType || !VALID_INVITE_TYPES.includes(inviteType)) {
      return NextResponse.json(
        { error: "Invalid or missing inviteType. Must be one of: " + VALID_INVITE_TYPES.join(", ") },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    let organizationId: string | null = bodyOrgId ?? null

    if (inviteType === "athletic_director_link_invite") {
      const adOrg = await getOrCreateAdOrganization(supabase, session.user.id)
      if (!adOrg) {
        return NextResponse.json(
          { error: "Only an Athletic Director can create a link code. You are not linked to an athletic department." },
          { status: 403 }
        )
      }
      organizationId = adOrg.organizationId
    }

    if (inviteType === "team_player_join" && !teamId) {
      return NextResponse.json({ error: "teamId is required for team_player_join" }, { status: 400 })
    }
    if (inviteType === "player_claim_invite" || inviteType === "parent_link_invite") {
      if (!targetPlayerId) {
        return NextResponse.json(
          { error: "targetPlayerId is required for player_claim_invite and parent_link_invite" },
          { status: 400 }
        )
      }
    }
    if (inviteType === "assistant_coach_invite" && !programId) {
      return NextResponse.json(
        { error: "programId is required for assistant_coach_invite" },
        { status: 400 }
      )
    }
    if (inviteType === "head_coach_team_invite" && !teamId && !programId) {
      return NextResponse.json(
        { error: "teamId or programId is required for head_coach_team_invite" },
        { status: 400 }
      )
    }

    const code = await generateUniqueInviteCode(supabase, 8)
    const expiresAt =
      typeof expiresInDays === "number" && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null

    const insertPayload: Record<string, unknown> = {
      code,
      invite_type: inviteType,
      organization_id: organizationId,
      program_id: programId ?? null,
      team_id: teamId ?? null,
      target_player_id: targetPlayerId ?? null,
      max_uses: maxUses ?? null,
      expires_at: expiresAt,
      is_active: true,
      created_by_user_id: session.user.id,
    }
    if (metadata != null && typeof metadata === "object") {
      insertPayload.metadata = metadata
    }

    const { data: row, error } = await supabase
      .from("invite_codes")
      .insert(insertPayload)
      .select("id, code, invite_type, organization_id, team_id, program_id, target_player_id, max_uses, expires_at")
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to create invite code" },
        { status: 500 }
      )
    }

    return NextResponse.json(row)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
