import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { generatePlayerSlug } from "@/lib/recruiting/slug"

/**
 * POST /api/recruiting/profile/coach
 * Create or update a player's recruiting profile. Coach must belong to the player's program.
 * Body: playerId, programId, teamId?, graduationYear?, heightFeet?, heightInches?, weightLbs?, fortyTime?, shuttleTime?, verticalJump?, gpa?,
 * recruitingVisibility?, statsVisible?, coachNotesVisible?, playbookMasteryVisible?, developmentVisible?, bio?, xHandle?, instagramHandle?, hudlUrl?, youtubeUrl?
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      playerId: string
      programId: string
      teamId?: string | null
      graduationYear?: number | null
      heightFeet?: number | null
      heightInches?: number | null
      weightLbs?: number | null
      fortyTime?: number | null
      shuttleTime?: number | null
      verticalJump?: number | null
      gpa?: number | null
      recruitingVisibility?: boolean
      statsVisible?: boolean
      coachNotesVisible?: boolean
      playbookMasteryVisible?: boolean
      developmentVisible?: boolean
      bio?: string | null
      xHandle?: string | null
      instagramHandle?: string | null
      hudlUrl?: string | null
      youtubeUrl?: string | null
    }

    const { playerId, programId } = body
    if (!playerId || !programId) {
      return NextResponse.json({ error: "playerId and programId are required" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id, first_name, last_name, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    const { data: team } = await supabase.from("teams").select("program_id").eq("id", teamId).maybeSingle()
    if (!team || (team as { program_id?: string }).program_id !== programId) {
      return NextResponse.json({ error: "Player is not in this program" }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from("player_recruiting_profiles")
      .select("id, graduation_year")
      .eq("player_id", playerId)
      .maybeSingle()

    const gradYear = body.graduationYear != null ? body.graduationYear : (existing as { graduation_year?: number } | null)?.graduation_year
    const slug = !existing
      ? generatePlayerSlug(
          (player as { first_name?: string }).first_name ?? "",
          (player as { last_name?: string }).last_name ?? "",
          gradYear ?? undefined,
          playerId
        )
      : undefined

    const payload: Record<string, unknown> = {
      player_id: playerId,
      program_id: programId,
      team_id: body.teamId ?? teamId,
      updated_at: new Date().toISOString(),
    }
    if (slug != null) payload.slug = slug
    if (body.graduationYear !== undefined) payload.graduation_year = body.graduationYear
    if (body.heightFeet !== undefined) payload.height_feet = body.heightFeet
    if (body.heightInches !== undefined) payload.height_inches = body.heightInches
    if (body.weightLbs !== undefined) payload.weight_lbs = body.weightLbs
    if (body.fortyTime !== undefined) payload.forty_time = body.fortyTime
    if (body.shuttleTime !== undefined) payload.shuttle_time = body.shuttleTime
    if (body.verticalJump !== undefined) payload.vertical_jump = body.verticalJump
    if (body.gpa !== undefined) payload.gpa = body.gpa
    if (body.recruitingVisibility !== undefined) payload.recruiting_visibility = body.recruitingVisibility
    if (body.statsVisible !== undefined) payload.stats_visible = body.statsVisible
    if (body.coachNotesVisible !== undefined) payload.coach_notes_visible = body.coachNotesVisible
    if (body.playbookMasteryVisible !== undefined) payload.playbook_mastery_visible = body.playbookMasteryVisible
    if (body.developmentVisible !== undefined) payload.development_visible = body.developmentVisible
    if (body.bio !== undefined) payload.bio = body.bio
    if (body.xHandle !== undefined) payload.x_handle = body.xHandle
    if (body.instagramHandle !== undefined) payload.instagram_handle = body.instagramHandle
    if (body.hudlUrl !== undefined) payload.hudl_url = body.hudlUrl
    if (body.youtubeUrl !== undefined) payload.youtube_url = body.youtubeUrl

    const { data: row, error } = await supabase
      .from("player_recruiting_profiles")
      .upsert(payload, { onConflict: "player_id" })
      .select("id, player_id, slug, recruiting_visibility, updated_at")
      .single()

    if (error) {
      console.error("[POST /api/recruiting/profile/coach]", error)
      return NextResponse.json({ error: "Failed to save recruiting profile" }, { status: 500 })
    }

    return NextResponse.json({
      id: row.id,
      playerId: row.player_id,
      slug: (row as { slug?: string }).slug ?? null,
      recruitingVisibility: (row as { recruiting_visibility?: boolean }).recruiting_visibility ?? false,
      updatedAt: (row as { updated_at?: string }).updated_at,
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/recruiting/profile/coach]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
