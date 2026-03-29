import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { buildPasswordSessionSuccessPayload } from "@/lib/auth/build-password-session-success"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { findInviteCode, consumeInviteCode } from "@/lib/invites/invite-codes"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"
import { headCoachSignupTeamLevels } from "@/lib/onboarding/head-coach-team-levels"
import { logTeamMembersAudit, setPrimaryHeadCoach, upsertStaffTeamMember } from "@/lib/team-members-sync"
import { getRequestClientIp } from "@/lib/http/request-client-ip"
import { claimPlayerInviteForUser } from "@/lib/player-invite-claim"

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
  programType?: string
  email?: string
  password?: string
  role?: string
  phone?: string
  sport?: string
  programCode?: string
  /** From /join?token= — links roster during signup (Phase 6). */
  joinToken?: string
  // Backward-compatible aliases from the existing flow
  name?: string
  teamName?: string
  teamId?: string
  sportType?: string
  smsOptIn?: boolean
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

function parseOptIn(value: unknown): boolean {
  return value === true || value === "true"
}

function parseSignupPayload(body: RawSignupBody) {
  const fullName = asNonEmptyString(body.fullName) ?? asNonEmptyString(body.name)
  const programName = asNonEmptyString(body.programName) ?? asNonEmptyString(body.teamName)
  const email = asNonEmptyString(body.email)?.toLowerCase() ?? null
  const password = asNonEmptyString(body.password)
  const phone = asNonEmptyString(body.phone)
  const sport = asNonEmptyString(body.sport) ?? asNonEmptyString(body.sportType)
  const programType = asNonEmptyString(body.programType)
  const programCode =
    (asNonEmptyString(body.programCode) ?? asNonEmptyString(body.teamId))?.toUpperCase() ?? null
  const joinToken = asNonEmptyString(body.joinToken)?.trim() ?? null
  const role = normalizeRole(asNonEmptyString(body.role))
  const smsOptIn = parseOptIn(body.smsOptIn)

  return {
    fullName,
    programName,
    email,
    password,
    role,
    phone,
    sport,
    programType,
    programCode,
    joinToken,
    smsOptIn,
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
    const { fullName, programName, email, password, role, phone, sport, programType, programCode, joinToken, smsOptIn } =
      parseSignupPayload(body)

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

    if (phone && !smsOptIn) {
      throw new SignupRouteError(
        400,
        "When you add a mobile number, please agree to transactional SMS messages from Braik (see checkbox) or remove the phone number to continue."
      )
    }

    // Prevent privileged role assignment through public signup.
    if (role === "admin") {
      throw new SignupRouteError(403, "Role tampering detected")
    }

    if (role === "parent" && !programCode) {
      throw new SignupRouteError(
        400,
        "A player code is required for parent accounts. Start at /parent/join to enter your child's code, then complete signup."
      )
    }

    if (role === "player" && !programCode && !joinToken) {
      throw new SignupRouteError(
        400,
        "Player accounts require a coach invite. Use the invite link from your coach, or enter your personal player code from the team portal."
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      throw new SignupRouteError(
        500,
        "Server is missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
      )
    }

    // Check if a user with this email already exists in auth.users first
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const existingAuthUser = authUsers?.users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim())
    
    if (existingAuthUser) {
      throw new SignupRouteError(
        409,
        "An account with this email already exists. Please sign in instead.",
        "Email already registered in authentication system"
      )
    }

    // Check if a user with this email already exists in public.users (orphaned record)
    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle()

    if (existingUserError && existingUserError.code !== "PGRST116") {
      // PGRST116 is "not found" which is fine, other errors are problems
      throw new SignupRouteError(500, "Database error while checking existing user", existingUserError.message)
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
      // Check if error is due to email already existing in auth
      const errorMsg = createAuthError?.message?.toLowerCase() || ""
      if (errorMsg.includes("already") || errorMsg.includes("exists") || errorMsg.includes("duplicate")) {
        throw new SignupRouteError(
          409,
          "An account with this email already exists. Please sign in instead.",
          createAuthError?.message
        )
      }
      throw mapCreateUserError(createAuthError?.message || "Unknown auth user creation error")
    }

    createdAuthUserId = authData.user.id

    // Ensure public.users row exists before any FKs (e.g. players.user_id) reference it
    // If email already exists, we need to update the existing record or handle the conflict
    if (existingUser && existingUser.id !== createdAuthUserId) {
      // Email exists with different ID - update the existing record to use the new auth user ID
      // This handles the case where a user record was created but auth user wasn't
      const { error: updateError } = await supabase
        .from("users")
        .update({
          id: createdAuthUserId,
          email,
          name: fullName,
          role: profileRoleToUserRole(role),
          status: "active",
        })
        .eq("id", existingUser.id)
      
      if (updateError) {
        // If update fails, try delete and insert
        const { error: deleteError } = await supabase
          .from("users")
          .delete()
          .eq("id", existingUser.id)
        
        // Ignore delete errors, continue with insert
        const { error: insertError } = await supabase
          .from("users")
          .insert({
            id: createdAuthUserId,
            email,
            name: fullName,
            role: profileRoleToUserRole(role),
            status: "active",
          })
        
        if (insertError) {
          throw new SignupRouteError(500, "Database failure while creating user record", insertError.message)
        }
      }
    } else {
      // Normal case: insert or update by ID
      const { error: usersUpsertError } = await supabase
        .from("users")
        .upsert(
          {
            id: createdAuthUserId,
            email,
            name: fullName,
            role: profileRoleToUserRole(role),
            status: "active",
          },
          { onConflict: "id" }
        )
      if (usersUpsertError) {
        // If upsert fails due to email conflict, try to find and update the existing record
        if (usersUpsertError.message?.includes("users_email_key") || usersUpsertError.message?.includes("duplicate key")) {
          const { data: emailUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", email.toLowerCase())
            .maybeSingle()
          
          if (emailUser) {
            // Update the existing user record to use the new auth ID
            const { error: updateError } = await supabase
              .from("users")
              .update({
                id: createdAuthUserId,
                name: fullName,
                role: profileRoleToUserRole(role),
                status: "active",
              })
              .eq("id", emailUser.id)
            
            if (updateError) {
              throw new SignupRouteError(500, "Database failure while updating user record", updateError.message)
            }
          } else {
            throw new SignupRouteError(500, "Database failure while creating user record", usersUpsertError.message)
          }
        } else {
          throw new SignupRouteError(500, "Database failure while creating user record", usersUpsertError.message)
        }
      }
    }

    let teamId: string | null = null
    let inviteCode: string | null = null

    if (role === "head_coach") {
      inviteCode = generateSecureInviteCode(8)
      const levels = headCoachSignupTeamLevels(sport, programType)
      const teamLevelNames: Record<string, string> = {
        varsity: programName!,
        jv: `JV ${programName}`,
        freshman: `Freshman ${programName}`,
      }

      let programIdRollback: string | null = null
      try {
        const { data: program, error: programError } = await supabase
          .from("programs")
          .insert({
            created_by_user_id: createdAuthUserId,
            program_name: programName!,
            sport: sport ?? "football",
            plan_type: "head_coach",
          })
          .select("id")
          .single()

        if (programError || !program?.id) {
          throw new SignupRouteError(500, "Database failure while creating program", programError?.message)
        }
        programIdRollback = program.id as string

        const insertedTeamIds: string[] = []

        for (const level of levels) {
          const name = level === "varsity" ? programName! : teamLevelNames[level] ?? programName!
          const isVarsity = level === "varsity"
          const row: Record<string, unknown> = {
            program_id: program.id,
            name,
            created_by: createdAuthUserId,
            team_level: level,
            plan_type: "head_coach",
            sport: sport ?? "football",
            roster_creation_mode: "coach_precreated",
          }
          if (isVarsity) {
            row.invite_code = inviteCode
          }

          console.info("[signup-secure] teams.insert", JSON.stringify({ ...row, invite_code: row.invite_code ? "[set]" : undefined }))

          const { data: insertedTeam, error: teamInsertError } = await supabase
            .from("teams")
            .insert(row)
            .select("id")
            .single()

          if (teamInsertError || !insertedTeam?.id) {
            throw new SignupRouteError(500, "Database failure while creating team", teamInsertError?.message)
          }
          insertedTeamIds.push(insertedTeam.id as string)
          if (isVarsity) {
            teamId = insertedTeam.id as string
          }
        }

        // Football program owner is always Director (explicit program_members role), not inferred from team count.
        const sportNorm = String(sport ?? "football")
          .trim()
          .toLowerCase()
        const programMemberRole =
          sportNorm === "football"
            ? "director_of_football"
            : levels.length > 1
              ? "director_of_football"
              : "head_coach"

        const { error: pmErr } = await supabase.from("program_members").upsert(
          {
            program_id: program.id,
            user_id: createdAuthUserId,
            role: programMemberRole,
            active: true,
          },
          { onConflict: "program_id,user_id" }
        )
        if (pmErr) {
          throw new SignupRouteError(500, "Database failure while assigning program membership", pmErr.message)
        }

        const { error: inviteInsertError } = await supabase.from("invites").insert({
          code: inviteCode,
          team_id: teamId,
          uses: 0,
        })
        if (inviteInsertError) {
          throw new SignupRouteError(500, "Database failure while creating invite", inviteInsertError.message)
        }

        for (const tid of insertedTeamIds) {
          const { error: hcErr } = await setPrimaryHeadCoach(supabase, tid, createdAuthUserId, {
            source: "signup_secure_head_coach",
          })
          if (hcErr) {
            throw new SignupRouteError(500, "Failed to save team staff membership", hcErr.message)
          }
        }

        programIdRollback = null
      } finally {
        if (programIdRollback) {
          await supabase.from("programs").delete().eq("id", programIdRollback)
        }
      }
    } else if (role === "parent" && programCode) {
      const { data: teamByPlayerJoinCode } = await supabase.from("teams").select("id").eq("player_code", programCode).maybeSingle()
      if (teamByPlayerJoinCode?.id) {
        throw new SignupRouteError(
          400,
          "That code is the shared team player join code. Enter your child's personal player code from the coach instead."
        )
      }

      let linkedPlayerId: string | null = null
      let linkedTeamId: string | null = null

      const typedParent = await findInviteCode(supabase, programCode, ["parent_link_invite"])
      if (typedParent?.target_player_id) {
        const { data: tp } = await supabase
          .from("players")
          .select("id, team_id")
          .eq("id", typedParent.target_player_id)
          .maybeSingle()
        if (tp?.team_id) {
          linkedPlayerId = tp.id as string
          linkedTeamId = tp.team_id as string
          const consume = await consumeInviteCode(supabase, typedParent.id, createdAuthUserId)
          if (consume.error) {
            console.warn("[signup-secure] parent_link consume", consume.error)
          }
        }
      }

      if (!linkedTeamId) {
        const { data: byPlayerCode, error: pcErr } = await supabase
          .from("players")
          .select("id, team_id")
          .eq("invite_code", programCode)
          .maybeSingle()
        if (!pcErr && byPlayerCode?.team_id) {
          linkedPlayerId = byPlayerCode.id as string
          linkedTeamId = byPlayerCode.team_id as string
        }
      }

      if (!linkedTeamId || !linkedPlayerId) {
        throw new SignupRouteError(
          400,
          "The player code you entered is not valid. Ask your coach for your child's personal player code."
        )
      }

      const { data: otherParentRows } = await supabase
        .from("parent_player_links")
        .select("id")
        .eq("player_id", linkedPlayerId)
        .limit(1)

      if (otherParentRows && otherParentRows.length > 0) {
        throw new SignupRouteError(
          409,
          "This player already has a linked parent account. Sign in with that account or contact support if you need help."
        )
      }

      const { data: existingParentLink } = await supabase
        .from("parent_player_links")
        .select("id")
        .eq("parent_user_id", createdAuthUserId)
        .eq("player_id", linkedPlayerId)
        .maybeSingle()

      if (existingParentLink) {
        throw new SignupRouteError(
          409,
          "This account is already linked to that player. Sign in instead."
        )
      }

      const { error: pplErr } = await supabase.from("parent_player_links").insert({
        parent_user_id: createdAuthUserId,
        player_id: linkedPlayerId,
        verified: true,
      })
      if (pplErr && !String(pplErr.message || "").toLowerCase().includes("duplicate")) {
        throw new SignupRouteError(500, "Failed to link parent account to player.", pplErr.message)
      }

      trackProductEventServer({
        eventName: BRAIK_EVENTS.auth.parent_linked,
        userId: createdAuthUserId,
        teamId: linkedTeamId,
        role: "PARENT",
        metadata: { via: "signup" },
      })

      teamId = linkedTeamId
    } else if (role === "player" && joinToken) {
      const claim = await claimPlayerInviteForUser(supabase, createdAuthUserId, { token: joinToken })
      if (!claim.ok) {
        throw new SignupRouteError(claim.status, claim.error)
      }
      teamId = claim.teamId
    } else if (programCode && role === "player") {
      try {
        const typedCode = await findInviteCode(supabase, programCode, ["team_player_join", "player_claim_invite"])
        if (typedCode) {
          if (typedCode.invite_type === "team_player_join" && typedCode.team_id) {
            const maxUses = typedCode.max_uses ?? Number.MAX_SAFE_INTEGER
            if (typedCode.uses >= maxUses) {
              throw new SignupRouteError(400, "This invite code has reached its maximum number of uses.")
            }
            const consume = await consumeInviteCode(supabase, typedCode.id, createdAuthUserId)
            if (consume.error) {
              throw new SignupRouteError(400, consume.error)
            }
            teamId = typedCode.team_id
          } else if (typedCode.invite_type === "player_claim_invite" && typedCode.target_player_id) {
            const { data: pl } = await supabase
              .from("players")
              .select("id, team_id")
              .eq("id", typedCode.target_player_id)
              .is("user_id", null)
              .maybeSingle()
            if (pl?.team_id) {
              const { error: linkErr } = await supabase
                .from("players")
                .update({
                  user_id: createdAuthUserId,
                  claimed_at: new Date().toISOString(),
                  invite_status: "joined",
                })
                .eq("id", pl.id)
              if (linkErr) {
                throw new SignupRouteError(500, "Failed to link your account to the roster.", linkErr.message)
              }
              await consumeInviteCode(supabase, typedCode.id, createdAuthUserId)
              teamId = pl.team_id as string
            }
          }
        }
      } catch (e) {
        if (e instanceof SignupRouteError) throw e
      }

      if (!teamId) {
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
        }
      }

      if (!teamId) {
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
    } else if (programCode) {
      try {
        const typedStaff = await findInviteCode(supabase, programCode, ["assistant_coach_invite", "athletic_director_link_invite"])
        if (typedStaff?.team_id) {
          const maxUses = typedStaff.max_uses ?? Number.MAX_SAFE_INTEGER
          if (typedStaff.uses >= maxUses) {
            throw new SignupRouteError(400, "This invite code has reached its maximum number of uses.")
          }
          const consume = await consumeInviteCode(supabase, typedStaff.id, createdAuthUserId)
          if (consume.error) {
            throw new SignupRouteError(400, consume.error)
          }
          teamId = typedStaff.team_id
        }
      } catch (e) {
        if (e instanceof SignupRouteError) throw e
      }

      if (!teamId) {
        const { data: teamByCode } = await supabase.from("teams").select("id").eq("team_id_code", programCode).maybeSingle()
        if (teamByCode?.id) {
          teamId = teamByCode.id as string
        }
      }

      if (!teamId) {
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

    const smsConsent = Boolean(phone) && smsOptIn
    const consentIp = getRequestClientIp(request)

    const { error: profileInsertError } = await supabase.from("profiles").upsert({
      id: createdAuthUserId,
      email,
      role,
      team_id: teamId,           // null when no code was provided
      full_name: fullName,
      phone: phone ?? null,
      sport: sport ?? null,
      program_name: programName ?? null,
      sms_opt_in: smsConsent,
      sms_opt_in_at: smsConsent ? new Date().toISOString() : null,
      sms_opt_in_method: smsConsent ? "web_form" : null,
      sms_opt_in_ip: smsConsent ? consentIp : null,
      sms_opt_in_source: smsConsent ? "signup" : null,
    })

    if (profileInsertError) {
      throw new SignupRouteError(500, "Database failure while creating profile", profileInsertError.message)
    }

    if (teamId && role !== "head_coach") {
      const tmRole =
        role === "assistant_coach"
          ? "assistant_coach"
          : role === "parent"
            ? "parent"
            : "player"
      const { error: tmErr } = await upsertStaffTeamMember(supabase, teamId, createdAuthUserId, tmRole, {
        source: "signup_secure",
        staffStatus: role === "assistant_coach" ? "pending_assignment" : "active",
      })
      if (tmErr) {
        throw new SignupRouteError(500, "Database failure while saving team membership", tmErr.message)
      }
    } else if (teamId && role === "head_coach") {
      const { data: tmCheck } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .eq("user_id", createdAuthUserId)
        .eq("role", "head_coach")
        .eq("active", true)
        .maybeSingle()
      if (!tmCheck) {
        logTeamMembersAudit("signup-secure.profile_without_head_coach_row", {
          teamId,
          userId: createdAuthUserId,
        })
      }
    }

    trackProductEventServer({
      eventName: BRAIK_EVENTS.auth.signup_completed,
      userId: createdAuthUserId,
      teamId: teamId ?? null,
      role: role ? role.replace(/-/g, "_").toUpperCase() : null,
      metadata: {
        profile_role: role,
        used_program_code: Boolean(programCode),
        used_join_token: Boolean(joinToken),
      },
    })

    const normalizedEmail = email.toLowerCase().trim()
    const signInClient = getSupabaseServer()
    const signInResult = await signInClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (!signInResult.error && signInResult.data.session && signInResult.data.user) {
      try {
        const sessionPayload = await buildPasswordSessionSuccessPayload(
          signInClient,
          signInResult.data,
          normalizedEmail,
          { rememberMe: false }
        )
        const response = NextResponse.json(
          {
            ...sessionPayload.body,
            teamId,
            inviteCode,
          },
          { status: 201 }
        )
        sessionPayload.applySessionCookies(response)
        return response
      } catch (sessionErr) {
        console.error("[signup-secure] establish session failed:", sessionErr)
      }
    } else if (signInResult.error) {
      console.warn("[signup-secure] post-signup signIn failed:", signInResult.error.message)
    }

    return NextResponse.json(
      {
        success: true,
        role,
        teamId,
        inviteCode,
        sessionEstablishFailed: true,
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

