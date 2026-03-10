import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  let code = ""
  for (let i = 0; i < length; i += 1) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

/**
 * POST /api/roster/generate-codes?teamId=xxx
 * Generates new join codes for the team.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage")

    const supabase = getSupabaseServer()

    // Generate unique codes
    let playerCode: string
    let parentCode: string
    let teamIdCode: string

    // Generate player code (check uniqueness)
    let attempts = 0
    do {
      playerCode = generateCode(8)
      const { data: existing } = await supabase
        .from("teams")
        .select("id")
        .eq("player_code", playerCode)
        .maybeSingle()
      if (!existing) break
      attempts++
    } while (attempts < 10)

    if (attempts >= 10) {
      return NextResponse.json({ error: "Failed to generate unique player code" }, { status: 500 })
    }

    // Generate parent code
    attempts = 0
    do {
      parentCode = generateCode(8)
      const { data: existing } = await supabase
        .from("teams")
        .select("id")
        .eq("parent_code", parentCode)
        .maybeSingle()
      if (!existing) break
      attempts++
    } while (attempts < 10)

    if (attempts >= 10) {
      return NextResponse.json({ error: "Failed to generate unique parent code" }, { status: 500 })
    }

    // Generate team ID code
    attempts = 0
    do {
      teamIdCode = generateCode(8)
      const { data: existing } = await supabase
        .from("teams")
        .select("id")
        .eq("team_id_code", teamIdCode)
        .maybeSingle()
      if (!existing) break
      attempts++
    } while (attempts < 10)

    if (attempts >= 10) {
      return NextResponse.json({ error: "Failed to generate unique team ID code" }, { status: 500 })
    }

    // Update team with new codes
    const { error: updateError } = await supabase
      .from("teams")
      .update({
        player_code: playerCode,
        parent_code: parentCode,
        team_id_code: teamIdCode,
      })
      .eq("id", teamId)

    if (updateError) {
      console.error("[POST /api/roster/generate-codes]", updateError)
      return NextResponse.json({ error: "Failed to update codes" }, { status: 500 })
    }

    return NextResponse.json({
      playerCode,
      parentCode,
      teamIdCode,
    })
  } catch (error: any) {
    console.error("[POST /api/roster/generate-codes]", error)
  return NextResponse.json(
      { error: error.message || "Failed to generate codes" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
  )
  }
}
