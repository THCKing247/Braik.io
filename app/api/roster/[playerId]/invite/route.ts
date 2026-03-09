import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { MembershipLookupError } from "@/lib/auth/rbac"

function generateInviteCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  let code = ""
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length]
  }
  return code
}

/**
 * POST /api/roster/[playerId]/invite - Generate and set an invite code for a coach-created player.
 * Coach can share this code with the player; when they sign up with it, they are linked to this player record.
 */
export async function POST(
  _request: Request,
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

    const { requireTeamPermission } = await import("@/lib/auth/rbac")
    const supabase = getSupabaseServer()

    const { data: player, error: fetchErr } = await supabase
      .from("players")
      .select("id, team_id, user_id, invite_code, invite_status")
      .eq("id", playerId)
      .maybeSingle()

    if (fetchErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission(player.team_id, "edit_roster")

    if ((player as { user_id?: string | null }).user_id) {
      return NextResponse.json(
        { error: "This player has already linked an account." },
        { status: 400 }
      )
    }

    let code = (player as { invite_code?: string | null }).invite_code
    if (!code) {
      for (let attempt = 0; attempt < 5; attempt++) {
        code = generateInviteCode(8)
        const { data: existing } = await supabase
          .from("players")
          .select("id")
          .eq("invite_code", code)
          .maybeSingle()
        if (!existing) break
      }
      if (!code) {
        return NextResponse.json({ error: "Failed to generate unique invite code" }, { status: 500 })
      }
    }

    const { data: updated, error } = await supabase
      .from("players")
      .update({ invite_code: code, invite_status: "invited" })
      .eq("id", playerId)
      .select()
      .single()

    if (error) {
      console.error("[POST /api/roster/[playerId]/invite]", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const p = updated as { invite_code?: string | null; invite_status?: string }
    return NextResponse.json({
      inviteCode: p.invite_code ?? code,
      inviteStatus: (p.invite_status ?? "invited") as "invited",
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      console.error("[POST /api/roster/[playerId]/invite] membership lookup failed (DB/schema)", err.message)
      return NextResponse.json({ error: "Failed to set invite" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/roster/[playerId]/invite]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
