import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export const runtime = "nodejs"

/**
 * GET current user's program (from their primary team) and whether it can be linked to an AD.
 * Used by head coach settings to show "Link to Athletic Director" when program is standalone.
 */
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServer()

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id, role")
      .eq("id", session.user.id)
      .maybeSingle()

    const teamId = profile?.team_id ?? null
    if (!teamId) {
      return NextResponse.json({
        program: null,
        canLinkToOrganization: false,
        reason: "no_team",
      })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("id, program_id, created_by")
      .eq("id", teamId)
      .maybeSingle()

    if (!team?.program_id) {
      return NextResponse.json({
        program: null,
        canLinkToOrganization: false,
        reason: "no_program",
      })
    }

    const isHeadCoach =
      profile?.role?.toLowerCase().replace(/-/g, "_") === "head_coach" ||
      (team as { created_by?: string }).created_by === session.user.id

    const { data: program } = await supabase
      .from("programs")
      .select("id, program_name, organization_id")
      .eq("id", team.program_id)
      .single()

    if (!program) {
      return NextResponse.json({
        program: null,
        canLinkToOrganization: false,
        reason: "no_program",
      })
    }

    const organizationId = (program as { organization_id?: string }).organization_id ?? null
    const isStandalone = !organizationId

    return NextResponse.json({
      program: {
        id: program.id,
        program_name: (program as { program_name?: string }).program_name,
        organization_id: organizationId,
      },
      canLinkToOrganization: isHeadCoach && isStandalone,
      reason: !isHeadCoach ? "not_head_coach" : !isStandalone ? "already_linked" : null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
