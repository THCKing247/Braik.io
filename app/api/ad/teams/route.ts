import { NextResponse } from "next/server"
import crypto from "crypto"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const role = session.user.role?.toUpperCase()
    if (role !== "ATHLETIC_DIRECTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json()) as {
      sport?: string
      teamName?: string
      rosterSize?: number
      season?: string
      headCoachFirstName?: string
      headCoachLastName?: string
      headCoachEmail?: string
      notes?: string
    }

    const teamName = String(body.teamName ?? "").trim()
    const sport = String(body.sport ?? "").trim()
    if (!teamName || !sport) {
      return NextResponse.json(
        { error: "Team name and sport are required." },
        { status: 400 }
      )
    }

    const rosterSize =
      body.rosterSize != null
        ? Math.max(0, Math.min(500, Number(body.rosterSize)))
        : null
    const season = body.season ? String(body.season).trim() || null : null
    const notes = body.notes ? String(body.notes).trim() || null : null
    const headCoachEmail = body.headCoachEmail ? String(body.headCoachEmail).trim().toLowerCase() : null
    const headCoachFirstName = body.headCoachFirstName ? String(body.headCoachFirstName).trim() || null : null
    const headCoachLastName = body.headCoachLastName ? String(body.headCoachLastName).trim() || null : null

    const supabase = getSupabaseServer()

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", session.user.id)
      .maybeSingle()

    if (!profile?.school_id) {
      return NextResponse.json(
        { error: "Your account is not linked to a school. Contact support." },
        { status: 400 }
      )
    }

    const { data: department } = await supabase
      .from("athletic_departments")
      .select("id")
      .eq("athletic_director_user_id", session.user.id)
      .maybeSingle()

    if (!department?.id) {
      return NextResponse.json(
        { error: "Athletic department not found. Contact support." },
        { status: 400 }
      )
    }

    const teamInsertPayload = {
      name: teamName,
      sport,
      roster_size: rosterSize,
      season,
      notes,
      school_id: profile.school_id,
      athletic_department_id: department.id,
      created_by: session.user.id,
    }
    console.info("[ad/teams] teams.insert", JSON.stringify(teamInsertPayload))

    const { data: team, error: teamError } = await supabase.from("teams").insert(teamInsertPayload).select("id").single()

    if (teamError || !team?.id) {
      return NextResponse.json(
        { error: teamError?.message ?? "Failed to create team." },
        { status: 500 }
      )
    }

    let inviteId: string | null = null
    if (headCoachEmail) {
      const token = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data: invite, error: inviteError } = await supabase
        .from("invites")
        .insert({
          team_id: team.id,
          email: headCoachEmail,
          role: "head_coach",
          token,
          expires_at: expiresAt.toISOString(),
          created_by: session.user.id,
          school_id: profile.school_id,
          athletic_department_id: department.id,
          invitee_first_name: headCoachFirstName,
          invitee_last_name: headCoachLastName,
        })
        .select("id")
        .single()

      if (!inviteError && invite?.id) {
        inviteId = invite.id
      }
    }

    return NextResponse.json(
      { success: true, teamId: team.id, inviteId },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
