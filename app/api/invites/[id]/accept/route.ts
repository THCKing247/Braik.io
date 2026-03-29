import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { revalidateAdTeamsTableCacheForUser } from "@/lib/ad/ad-teams-table-server-cache"
import { validateInviteById } from "@/lib/invites/validate-invite"
import { acceptInvite } from "@/lib/invites/accept-invite"

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: "You must be signed in to accept this invitation." },
        { status: 401 }
      )
    }

    const inviteId = params.id
    if (!inviteId) {
      return NextResponse.json(
        { error: "Invite ID is required." },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    const validation = await validateInviteById(supabase, inviteId)

    if (!validation.valid) {
      switch (validation.reason) {
        case "not_found":
        case "team_missing":
          return NextResponse.json(
            { error: "Invitation not found." },
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

    const result = await acceptInvite(
      supabase,
      validation.invite,
      session.user.id,
      session.user.email,
      session.user.name ?? null
    )

    if (!result.success) {
      const status =
        result.reason === "email_mismatch"
          ? 403
          : result.reason === "head_coach_exists"
            ? 409
            : 500
      return NextResponse.json(
        { error: result.message },
        { status }
      )
    }

    const inviterId = validation.invite.created_by
    if (inviterId) revalidateAdTeamsTableCacheForUser(inviterId)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
