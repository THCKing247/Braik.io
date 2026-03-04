import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const ALLOWED_ROLES = new Set(["admin", "head_coach", "assistant_coach", "player", "parent"])

class SignupRouteError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
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
    return new SignupRouteError(409, "A user with this email already exists")
  }

  return new SignupRouteError(500, "Failed to create auth user")
}

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null

  try {
    const body = (await request.json()) as RawSignupBody
    const { fullName, programName, email, password, role, phone, sport, programCode } = parseSignupPayload(body)

    if (!fullName || !programName || !email || !password || !sport || !role) {
      throw new SignupRouteError(
        400,
        "Missing required fields: fullName, programName, email, password, role, and sport are required"
      )
    }

    if (password.length < 8) {
      throw new SignupRouteError(400, "Password must be at least 8 characters")
    }

    // Prevent privileged role assignment through public signup.
    if (role === "admin") {
      throw new SignupRouteError(403, "Role tampering detected")
    }

    if (role !== "head_coach" && !programCode) {
      throw new SignupRouteError(400, "Invalid invite code")
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      throw new SignupRouteError(500, "Supabase Admin client is not configured")
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

    let teamId: string
    let inviteCode: string | null = null

    if (role === "head_coach") {
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
        throw new SignupRouteError(500, "Database failure while creating team")
      }

      teamId = insertedTeam.id as string

      const { error: inviteInsertError } = await supabase.from("invites").insert({
        code: inviteCode,
        team_id: teamId,
        uses: 0,
      })

      if (inviteInsertError) {
        throw new SignupRouteError(500, "Database failure while creating invite")
      }
    } else {
      const { data: invite, error: inviteLookupError } = await supabase
        .from("invites")
        .select("id, team_id, uses, max_uses, expires_at")
        .eq("code", programCode)
        .maybeSingle()

      if (inviteLookupError) {
        throw new SignupRouteError(500, "Database failure while validating invite")
      }

      if (!invite || !invite.team_id) {
        throw new SignupRouteError(400, "Invalid invite code")
      }

      const uses = typeof invite.uses === "number" ? invite.uses : 0
      const maxUses = typeof invite.max_uses === "number" ? invite.max_uses : Number.MAX_SAFE_INTEGER
      if (uses >= maxUses) {
        throw new SignupRouteError(400, "Invalid invite code")
      }

      if (invite.expires_at) {
        const expiresAt = new Date(invite.expires_at as string)
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
          throw new SignupRouteError(400, "Invalid invite code")
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

    const { error: profileInsertError } = await supabase.from("profiles").upsert({
      id: createdAuthUserId,
      email,
      role,
      team_id: teamId,
      full_name: fullName,
      phone,
      sport,
      program_name: programName,
    })

    if (profileInsertError) {
      throw new SignupRouteError(500, "Database failure while creating profile")
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
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Secure signup route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

