import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"

const ALLOWED_ROLES = new Set(["admin", "head_coach", "assistant_coach", "player", "parent"])

class SignupRouteError extends Error {
  status: number
  details?: string

  constructor(status: number, message: string, details?: string) {
    super(message)
    this.status = status
    this.details = details
  }
}

type RawSignupBody = {
  fullName?: string
  programName?: string
  email?: string
  password?: string
  role?: string
  phone?: string
  sport?: string
  programCode?: string
  // Backward-compatible aliases from the existing flow
  name?: string
  teamName?: string
  teamId?: string
  sportType?: string
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeRole(rawRole: string | null): string | null {
  if (!rawRole) {
    return null
  }

  const normalized = rawRole.trim().toLowerCase().replace(/-/g, "_")
  if (!ALLOWED_ROLES.has(normalized)) {
    return null
  }
  return normalized
}

function generateSecureInviteCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  let code = ""

  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length]
  }

  return code
}

function parseSignupPayload(body: RawSignupBody) {
  const fullName = asNonEmptyString(body.fullName) ?? asNonEmptyString(body.name)
  const programName = asNonEmptyString(body.programName) ?? asNonEmptyString(body.teamName)
  const email = asNonEmptyString(body.email)?.toLowerCase() ?? null
  const password = asNonEmptyString(body.password)
  const phone = asNonEmptyString(body.phone)
  const sport = asNonEmptyString(body.sport) ?? asNonEmptyString(body.sportType)
  const programCode =
    (asNonEmptyString(body.programCode) ?? asNonEmptyString(body.teamId))?.toUpperCase() ?? null
  const role = normalizeRole(asNonEmptyString(body.role))

  return {
    fullName,
    programName,
    email,
    password,
    role,
    phone,
    sport,
    programCode,
  }
}

function mapCreateUserError(errorMessage: string): SignupRouteError {
  const message = errorMessage.toLowerCase()
  if (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("unique")
  ) {
    return new SignupRouteError(409, "An account with this email already exists. Please sign in instead.")
  }

  if (message.includes("password") && (message.includes("weak") || message.includes("short") || message.includes("characters"))) {
    return new SignupRouteError(400, "Password does not meet Supabase requirements.", errorMessage)
  }

  if (message.includes("invalid email") || message.includes("email address")) {
    return new SignupRouteError(400, "Invalid email address.", errorMessage)
  }

  // Surface the raw Supabase error as `details` so the frontend can display it
  return new SignupRouteError(500, "Failed to create auth user", errorMessage)
}

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null

  try {
    const body = (await request.json()) as RawSignupBody
    const { fullName, programName, email, password, role, phone, sport, programCode } = parseSignupPayload(body)

    // programName and sport are only required when the user is creating a new team (head_coach)
    const isHeadCoach = role === "head_coach"
    if (!fullName || !email || !password || !role) {
      throw new SignupRouteError(
        400,
        "Missing required fields: fullName (or name), email, password, and role are required"
      )
    }
    if (isHeadCoach && (!programName || !sport)) {
      throw new SignupRouteError(
        400,
        "Missing required fields for Head Coach: programName (or teamName) and sport (or sportType) are required"
      )
    }

    if (password.length < 8) {
      throw new SignupRouteError(400, "Password must be at least 8 characters")
    }

    // Prevent privileged role assignment through public signup.
    if (role === "admin") {
      throw new SignupRouteError(403, "Role tampering detected")
    }

    // Note: programCode is now OPTIONAL for non-head-coach roles.
    // Users can join a team from the dashboard after signing up.

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      throw new SignupRouteError(
        500,
        "Server is missing Supabase credentials. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment variables."
      )
    }

    const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        fullName,
        role,
        phone,
        sport,
        programName,
      },
    })

    if (createAuthError || !authData.user) {
      throw mapCreateUserError(createAuthError?.message || "Unknown auth user creation error")
    }

    createdAuthUserId = authData.user.id

    let teamId: string | null = null
    let inviteCode: string | null = null

    if (role === "head_coach") {
      // Head Coach always creates a brand-new team immediately.
      inviteCode = generateSecureInviteCode(8)

      const { data: insertedTeam, error: teamInsertError } = await supabase
        .from("teams")
        .insert({
          name: programName,
          created_by: createdAuthUserId,
          invite_code: inviteCode,
        })
        .select("id")
        .single()

      if (teamInsertError || !insertedTeam?.id) {
        throw new SignupRouteError(500, "Database failure while creating team", teamInsertError?.message)
      }

      teamId = insertedTeam.id as string

      const { error: inviteInsertError } = await supabase.from("invites").insert({
        code: inviteCode,
        team_id: teamId,
        uses: 0,
      })

      if (inviteInsertError) {
        throw new SignupRouteError(500, "Database failure while creating invite", inviteInsertError.message)
      }
    } else if (programCode) {
      // Prefer linking to an existing coach-created player (by players.invite_code) to avoid duplicate roster rows.
      const { data: existingPlayer, error: playerLookupErr } = await supabase
        .from("players")
        .select("id, team_id")
        .eq("invite_code", programCode)
        .is("user_id", null)
        .maybeSingle()

      if (!playerLookupErr && existingPlayer?.team_id) {
        teamId = existingPlayer.team_id as string
        const { error: linkErr } = await supabase
          .from("players")
          .update({
            user_id: createdAuthUserId,
            claimed_at: new Date().toISOString(),
            invite_status: "joined",
          })
          .eq("id", existingPlayer.id)
        if (linkErr) {
          throw new SignupRouteError(500, "Failed to link your account to the roster.", linkErr.message)
        }
      } else {
        // Fall back to team invite code (invites.code)
        const { data: invite, error: inviteLookupError } = await supabase
          .from("invites")
          .select("id, team_id, uses, max_uses, expires_at")
          .eq("code", programCode)
          .maybeSingle()

        if (inviteLookupError) {
          throw new SignupRouteError(500, "Database failure while validating invite")
        }

        if (!invite || !invite.team_id) {
          throw new SignupRouteError(400, "The code you entered is not valid. Double-check it with your coach or try again later.")
        }

        const uses = typeof invite.uses === "number" ? invite.uses : 0
        const maxUses = typeof invite.max_uses === "number" ? invite.max_uses : Number.MAX_SAFE_INTEGER
        if (uses >= maxUses) {
          throw new SignupRouteError(400, "This invite code has reached its maximum number of uses.")
        }

        if (invite.expires_at) {
          const expiresAt = new Date(invite.expires_at as string)
          if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
            throw new SignupRouteError(400, "This invite code has expired. Ask your coach for a fresh one.")
          }
        }

        teamId = invite.team_id as string

        const { error: inviteUpdateError } = await supabase
          .from("invites")
          .update({ uses: uses + 1 })
          .eq("id", invite.id)

        if (inviteUpdateError) {
          throw new SignupRouteError(500, "Database failure while updating invite usage")
        }
      }
    }
    // else: no code provided — user signs up without a team and will connect later.

    const { error: profileInsertError } = await supabase.from("profiles").upsert({
      id: createdAuthUserId,
      email,
      role,
      team_id: teamId,           // null when no code was provided
      full_name: fullName,
      phone: phone ?? null,
      sport: sport ?? null,
      program_name: programName ?? null,
    })

    if (profileInsertError) {
      throw new SignupRouteError(500, "Database failure while creating profile", profileInsertError.message)
    }

    // Ensure a row exists in public.users BEFORE team_members insert (team_members.user_id FK references users.id).
    const userRole = profileRoleToUserRole(role)
    try {
      await supabase
        .from("users")
        .upsert(
          {
            id: createdAuthUserId,
            email,
            name: fullName,
            role: userRole,
            status: "active",
          },
          { onConflict: "id" }
        )
    } catch {
      // ignore — public.users may not exist in all environments
    }

    // Insert team_members when user is linked to a team. Required for roster and RBAC; do not treat as non-fatal.
    if (teamId) {
      const teamMemberRole =
        role === "head_coach"
          ? "HEAD_COACH"
          : role === "assistant_coach"
          ? "ASSISTANT_COACH"
          : role === "player"
          ? "PLAYER"
          : role === "parent"
          ? "PARENT"
          : "PLAYER"

      const { error: memberInsertError } = await supabase.from("team_members").insert({
        team_id: teamId,
        user_id: createdAuthUserId,
        role: teamMemberRole,
        active: true,
      })

      if (memberInsertError) {
        throw new SignupRouteError(
          500,
          "Your account was created but we could not add you to the team. Please try joining the team again from the dashboard or contact support.",
          memberInsertError.message
        )
      }
    }

    return NextResponse.json(
      {
        success: true,
        role,
        teamId,
        inviteCode,
      },
      { status: 201 }
    )
  } catch (error) {
    if (createdAuthUserId) {
      const supabase = getSupabaseAdminClient()
      if (supabase) {
        await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
      }
    }

    if (error instanceof SignupRouteError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.status }
      )
    }

    const unknownMsg = error instanceof Error ? error.message : String(error)
    console.error("Secure signup route error:", unknownMsg)
    return NextResponse.json({ error: "Internal server error", details: unknownMsg }, { status: 500 })
  }
}

