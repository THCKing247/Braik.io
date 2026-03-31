import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { revalidateAdTeamsTableCacheForUser } from "@/lib/ad/ad-teams-table-server-cache"
import { validateInviteById } from "@/lib/invites/validate-invite"
import { acceptInvite } from "@/lib/invites/accept-invite"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * Password-based registration for an existing team invite (not public self-serve signup).
 * Replaces the old `/api/auth/signup` + `/accept` two-step flow for invite acceptance.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let createdAuthUserId: string | null = null

  try {
    const { id: inviteId } = await params
    const body = (await request.json()) as { name?: string; password?: string }
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!inviteId || !password) {
      return NextResponse.json({ error: "Invite id and password are required." }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
    }

    const validation = await validateInviteById(getSupabaseServer(), inviteId)
    if (!validation.valid) {
      switch (validation.reason) {
        case "not_found":
        case "team_missing":
          return NextResponse.json({ error: "Invitation not found." }, { status: 404 })
        case "expired":
          return NextResponse.json({ error: "This invitation has expired." }, { status: 410 })
        case "already_accepted":
          return NextResponse.json({ error: "This invitation has already been accepted." }, { status: 409 })
        default:
          return NextResponse.json({ error: "Invalid invitation." }, { status: 400 })
      }
    }

    const { invite } = validation
    const email = invite.email.trim().toLowerCase()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name || email,
        role: invite.role,
      },
    })

    if (authError || !authData.user) {
      const msg = (authError?.message ?? "").toLowerCase()
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Sign in to accept the invitation." },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: authError?.message ?? "Failed to create account." }, { status: 400 })
    }

    createdAuthUserId = authData.user.id

    const result = await acceptInvite(supabase, invite, createdAuthUserId, email, name || null)

    if (!result.success) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
      return NextResponse.json(
        { error: result.message },
        { status: result.reason === "head_coach_exists" ? 409 : 500 }
      )
    }

    const inviterId = invite.created_by
    if (inviterId) revalidateAdTeamsTableCacheForUser(inviterId)

    return NextResponse.json({ success: true, userId: createdAuthUserId }, { status: 201 })
  } catch {
    const supabase = getSupabaseAdminClient()
    if (createdAuthUserId && supabase) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
    }
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 })
  }
}

export const runtime = "nodejs"
