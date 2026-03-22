import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { setPrimaryHeadCoach, upsertStaffTeamMember } from "@/lib/team-members-sync"

type SignupPayload = {
  fullName?: string
  programName?: string
  email?: string
  password?: string
  role?: string
  phone?: string
  sport?: string
  programCode?: string
  name?: string
  teamName?: string
  teamId?: string
  sportType?: string
}

const ROLE_MAP: Record<string, string> = {
  "head-coach": "head_coach",
  "assistant-coach": "assistant_coach",
  head_coach: "head_coach",
  assistant_coach: "assistant_coach",
  player: "player",
  athlete: "player", // profile/team role is "player"; public.users.role will be "athlete" on login
  parent: "parent",
  admin: "admin",
}

function randomInviteCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  let code = ""
  for (let i = 0; i < length; i += 1) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ success: false, error: "Server auth is not configured" }, { status: 500 })
    }

    const supabaseServerClient = getSupabaseServer()

    const body = (await request.json()) as SignupPayload
    const email = toStringOrNull(body.email)?.toLowerCase()
    const password = toStringOrNull(body.password)
    const role = ROLE_MAP[(toStringOrNull(body.role) || "").toLowerCase()]
    const fullName = toStringOrNull(body.fullName) || toStringOrNull(body.name) || ""
    const programName = toStringOrNull(body.programName) || toStringOrNull(body.teamName) || "Program"
    const sport = toStringOrNull(body.sport) || toStringOrNull(body.sportType) || "Football"
    const phone = toStringOrNull(body.phone) || ""
    const programCode = (toStringOrNull(body.programCode) || toStringOrNull(body.teamId) || "").toUpperCase()

    if (!email || !password || !role) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    const { data: authUser, error: authError } = await supabaseServerClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError || !authUser.user) {
      return NextResponse.json({ success: false, error: authError?.message || "Failed to create auth user" }, { status: 400 })
    }

    let teamId: string | null = null
    if (role === "head_coach") {
      const inviteCode = randomInviteCode(8)
      const sportNormalized = sport.trim().toLowerCase() || "football"
      const insertPayload = {
        name: programName,
        invite_code: inviteCode,
        created_by: authUser.user.id,
        sport: sportNormalized,
      }
      console.info("[signup] teams.insert (legacy head coach)", JSON.stringify({ ...insertPayload, invite_code: "[redacted]" }))

      const { data: createdTeam, error: teamError } = await supabaseServerClient
        .from("teams")
        .insert(insertPayload)
        .select("id")
        .single()

      if (teamError || !createdTeam?.id) {
        await supabaseServerClient.auth.admin.deleteUser(authUser.user.id)
        return NextResponse.json({ success: false, error: "Failed to create team" }, { status: 500 })
      }

      teamId = createdTeam.id as string
    } else {
      if (!programCode) {
        await supabaseServerClient.auth.admin.deleteUser(authUser.user.id)
        return NextResponse.json({ success: false, error: "Program code is required" }, { status: 400 })
      }

      const { data: invite, error: inviteError } = await supabaseServerClient
        .from("invites")
        .select("id, team_id, uses, max_uses, expires_at")
        .eq("code", programCode)
        .maybeSingle()

      if (inviteError || !invite?.team_id) {
        await supabaseServerClient.auth.admin.deleteUser(authUser.user.id)
        return NextResponse.json({ success: false, error: "Invalid invite code" }, { status: 400 })
      }

      const uses = typeof invite.uses === "number" ? invite.uses : 0
      const maxUses = typeof invite.max_uses === "number" ? invite.max_uses : Number.MAX_SAFE_INTEGER
      const isExpired = invite.expires_at ? new Date(String(invite.expires_at)).getTime() < Date.now() : false
      if (uses >= maxUses || isExpired) {
        await supabaseServerClient.auth.admin.deleteUser(authUser.user.id)
        return NextResponse.json({ success: false, error: "Invalid invite code" }, { status: 400 })
      }

      const { error: updateInviteError } = await supabaseServerClient
        .from("invites")
        .update({ uses: uses + 1 })
        .eq("id", invite.id)

      if (updateInviteError) {
        await supabaseServerClient.auth.admin.deleteUser(authUser.user.id)
        return NextResponse.json({ success: false, error: "Failed to update invite usage" }, { status: 500 })
      }

      teamId = invite.team_id as string
    }

    const { error: profileError } = await supabaseServerClient.from("profiles").upsert({
      id: authUser.user.id,
      email,
      role,
      team_id: teamId,
      full_name: fullName,
      phone,
      sport,
      program_name: programName,
    })

    if (profileError) {
      await supabaseServerClient.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ success: false, error: "Failed to create profile" }, { status: 500 })
    }

    if (teamId) {
      if (role === "head_coach") {
        const { error: tmErr } = await setPrimaryHeadCoach(supabaseServerClient, teamId, authUser.user.id, {
          source: "signup_legacy_head_coach",
        })
        if (tmErr) {
          await supabaseServerClient.auth.admin.deleteUser(authUser.user.id)
          return NextResponse.json({ success: false, error: "Failed to save team staff membership" }, { status: 500 })
        }
      } else {
        const tmRole =
          role === "assistant_coach"
            ? "assistant_coach"
            : role === "parent"
              ? "parent"
              : "player"
        const { error: tmErr } = await upsertStaffTeamMember(supabaseServerClient, teamId, authUser.user.id, tmRole, {
          source: "signup_legacy",
        })
        if (tmErr) {
          await supabaseServerClient.auth.admin.deleteUser(authUser.user.id)
          return NextResponse.json({ success: false, error: "Failed to save team membership" }, { status: 500 })
        }
      }

      try {
        await supabaseServerClient
          .from("users")
          .upsert(
            {
              id: authUser.user.id,
              email,
              name: fullName,
              role: profileRoleToUserRole(role),
              status: "active",
            },
            { onConflict: "id" }
          )
      } catch {
        // best-effort
      }
    }

    return NextResponse.json({ success: true, role, teamId })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Signup failed" },
      { status: 500 }
    )
  }
}

