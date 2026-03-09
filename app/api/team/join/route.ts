import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "You must be signed in to join a team." }, { status: 401 })
    }

    const { code } = (await request.json()) as { code?: string }
    const normalizedCode = code?.trim().toUpperCase()
    if (!normalizedCode) {
      return NextResponse.json({ success: false, error: "Please enter a code." }, { status: 400 })
    }

    // Prevent users who already have a team from joining another
    if (session.user.teamId) {
      return NextResponse.json(
        { success: false, error: "You are already connected to a team." },
        { status: 409 }
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 })
    }

    const userId = session.user.id
    const rawRole = (session.user.role || "PLAYER").toUpperCase()
    const teamMemberRole =
      rawRole === "ASSISTANT_COACH" ? "ASSISTANT_COACH" :
      rawRole === "PLAYER" ? "PLAYER" :
      rawRole === "PARENT" ? "PARENT" :
      "PLAYER"

    let teamId: string | null = null
    let usedPlayerInvite = false

    // Prefer linking to an existing coach-created player (by players.invite_code) to avoid duplicate roster rows
    const { data: existingPlayer, error: playerLookupErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("invite_code", normalizedCode)
      .is("user_id", null)
      .maybeSingle()

    if (!playerLookupErr && existingPlayer?.team_id) {
      teamId = existingPlayer.team_id as string
      usedPlayerInvite = true
      const { error: linkErr } = await supabase
        .from("players")
        .update({
          user_id: userId,
          claimed_at: new Date().toISOString(),
          invite_status: "joined",
        })
        .eq("id", existingPlayer.id)
      if (linkErr) {
        return NextResponse.json(
          { success: false, error: "Failed to link your account to the roster.", details: linkErr.message },
          { status: 500 }
        )
      }
    }

    if (!teamId) {
      // Fall back to team invite code (invites.code)
      const { data: invite, error: lookupError } = await supabase
        .from("invites")
        .select("id, team_id, uses, max_uses, expires_at")
        .eq("code", normalizedCode)
        .maybeSingle()

      if (lookupError) {
        return NextResponse.json({ success: false, error: "Could not validate the code." }, { status: 500 })
      }

      if (!invite || !invite.team_id) {
        return NextResponse.json(
          { success: false, error: "That code is not valid. Double-check it with your coach." },
          { status: 400 }
        )
      }

      const uses = typeof invite.uses === "number" ? invite.uses : 0
      const maxUses = typeof invite.max_uses === "number" ? invite.max_uses : Number.MAX_SAFE_INTEGER
      if (uses >= maxUses) {
        return NextResponse.json(
          { success: false, error: "This invite code has reached its maximum number of uses." },
          { status: 400 }
        )
      }

      if (invite.expires_at) {
        const expiresAt = new Date(invite.expires_at as string)
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
          return NextResponse.json(
            { success: false, error: "This invite code has expired. Ask your coach for a fresh one." },
            { status: 400 }
          )
        }
      }

      teamId = invite.team_id as string

      await supabase
        .from("invites")
        .update({ uses: uses + 1 })
        .eq("id", invite.id)
    }

    // Ensure user exists in public.users so team_members upsert (FK) succeeds.
    try {
      await supabase
        .from("users")
        .upsert(
          {
            id: userId,
            email: session.user.email ?? "",
            name: session.user.name ?? null,
            role: profileRoleToUserRole(session.user.role ?? "player"),
            status: "active",
          },
          { onConflict: "id" }
        )
    } catch {
      // best-effort; team_members upsert may still succeed if user row exists
    }

    // Update the user's profile to link them to the team
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ team_id: teamId })
      .eq("id", userId)

    if (profileUpdateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update your profile.", details: profileUpdateError.message },
        { status: 500 }
      )
    }

    // Insert team_members row (upsert in case row already exists). Required for roster and RBAC.
    const { error: memberError } = await supabase.from("team_members").upsert(
      {
        team_id: teamId,
        user_id: userId,
        role: teamMemberRole,
        active: true,
      },
      { onConflict: "team_id,user_id" }
    )

    if (memberError) {
      return NextResponse.json(
        { success: false, error: "Failed to add you to the team.", details: memberError.message },
        { status: 500 }
      )
    }

    // Fetch team name for the success message
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      teamId,
      teamName: team?.name ?? "your team",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: "An unexpected error occurred.", details: msg }, { status: 500 })
  }
}
