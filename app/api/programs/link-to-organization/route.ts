import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { findInviteCode, consumeInviteCode } from "@/lib/invites/invite-codes"
import { syncProgramTeamsMetadataFromOrganization } from "@/lib/sync-program-teams-metadata"

export const runtime = "nodejs"

/**
 * Link the current head coach's standalone program to an Athletic Director organization
 * using an athletic_director_link_invite code.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "You must be signed in to link your program." }, { status: 401 })
    }

    const body = (await request.json()) as { code?: string }
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : ""
    if (!code) {
      return NextResponse.json({ error: "Please enter the link code from your Athletic Director." }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Resolve current user's program (head coach must own a program via their primary team)
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id, role")
      .eq("id", session.user.id)
      .maybeSingle()

    const teamId = profile?.team_id ?? null
    if (!teamId) {
      return NextResponse.json(
        { error: "You don't have a team linked. Link your program from your primary team." },
        { status: 400 }
      )
    }

    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("id, program_id, created_by")
      .eq("id", teamId)
      .maybeSingle()

    if (teamErr || !team?.program_id) {
      return NextResponse.json(
        { error: "Your team is not part of a program, or the program could not be found." },
        { status: 400 }
      )
    }

    const programId = team.program_id as string
    const isCreator = (team as { created_by?: string }).created_by === session.user.id
    const isHeadCoach =
      profile?.role?.toLowerCase().replace(/-/g, "_") === "head_coach" || isCreator

    if (!isHeadCoach) {
      return NextResponse.json(
        { error: "Only the head coach (program owner) can link this program to an Athletic Director." },
        { status: 403 }
      )
    }

    // Ensure program is standalone (not already linked)
    const { data: program, error: programErr } = await supabase
      .from("programs")
      .select("id, organization_id")
      .eq("id", programId)
      .single()

    if (programErr || !program) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 })
    }

    if ((program as { organization_id?: string }).organization_id) {
      return NextResponse.json(
        { error: "This program is already linked to an Athletic Director organization." },
        { status: 400 }
      )
    }

    // Validate and use the link code
    const linkCode = await findInviteCode(supabase, code, ["athletic_director_link_invite"])
    if (!linkCode) {
      return NextResponse.json(
        {
          error:
            "That code is not valid. It may be incorrect, expired, already used, or not a link code. Ask your Athletic Director for a new code.",
        },
        { status: 400 }
      )
    }

    const orgId = linkCode.organization_id ?? null
    if (!orgId) {
      return NextResponse.json(
        { error: "This link code is not associated with an organization. Ask your Athletic Director for a new code." },
        { status: 400 }
      )
    }

    const maxUses = linkCode.max_uses ?? Number.MAX_SAFE_INTEGER
    if (linkCode.uses >= maxUses) {
      return NextResponse.json(
        { error: "This link code has reached its maximum number of uses. Ask your Athletic Director for a new code." },
        { status: 400 }
      )
    }

    // Verify organization exists (and optionally that it belongs to an AD)
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .maybeSingle()

    if (orgErr || !org) {
      return NextResponse.json(
        { error: "The organization for this code could not be found. Please contact support." },
        { status: 400 }
      )
    }

    // Attach program to organization (no duplicate; preserve head coach and all data)
    const { error: updateErr } = await supabase
      .from("programs")
      .update({
        organization_id: orgId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", programId)

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message ?? "Failed to link program to organization." },
        { status: 500 }
      )
    }

    const sync = await syncProgramTeamsMetadataFromOrganization(supabase, programId, orgId)
    if (sync.error) {
      console.warn("[programs/link-to-organization] team metadata sync:", sync.error, sync.preview)
    } else {
      console.info("[programs/link-to-organization] team metadata sync ok", JSON.stringify(sync.preview))
    }

    // Consume the invite code (one use)
    const consume = await consumeInviteCode(supabase, linkCode.id, session.user.id)
    if (consume.error) {
      // Program is already linked; log and return success (idempotent-friendly)
      console.warn("[programs/link-to-organization] consume failed after link:", consume.error)
    }

    revalidatePath("/dashboard/ad")
    revalidatePath("/dashboard/ad/teams")

    return NextResponse.json({
      success: true,
      programId,
      organizationId: orgId,
      message: "Your program is now linked to the Athletic Director organization.",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
