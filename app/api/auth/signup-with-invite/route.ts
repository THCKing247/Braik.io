import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { validateInviteByToken } from "@/lib/invites/validate-invite"
import { acceptInvite } from "@/lib/invites/accept-invite"

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null

  try {
    const body = (await request.json()) as { token?: string; name?: string; password?: string }
    const token = typeof body.token === "string" ? body.token.trim() : ""
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!token || !password) {
      return NextResponse.json(
        { error: "Invite token and password are required." },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      )
    }

    const validation = await validateInviteByToken(supabase, token)
    if (!validation.valid) {
      switch (validation.reason) {
        case "not_found":
        case "team_missing":
          return NextResponse.json(
            { error: "Invitation not found or invalid." },
            { status: 404 }
          )
        case "expired":
          return NextResponse.json(
            { error: "This invitation has expired." },
            { status: 410 }
          )
        case "already_accepted":
          return NextResponse.json(
            { error: "This invitation has already been accepted." },
            { status: 409 }
          )
        default:
          return NextResponse.json(
            { error: "Invalid invitation." },
            { status: 400 }
          )
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
      if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in and accept the invitation." },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: authError?.message ?? "Failed to create account." },
        { status: 400 }
      )
    }

    createdAuthUserId = authData.user.id

    const result = await acceptInvite(
      supabase,
      invite,
      createdAuthUserId,
      email,
      name || null
    )

    if (!result.success) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
      return NextResponse.json(
        { error: result.message },
        { status: result.reason === "head_coach_exists" ? 409 : 500 }
      )
    }

    return NextResponse.json(
      { success: true, userId: createdAuthUserId },
      { status: 201 }
    )
  } catch (err) {
    if (createdAuthUserId) {
      const supabase = getSupabaseAdminClient()
      if (supabase) {
        await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined)
      }
    }
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
