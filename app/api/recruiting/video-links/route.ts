import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const VIDEO_TYPES = ["highlight_film", "full_game", "practice_film", "training_clip", "other"] as const

/**
 * POST /api/recruiting/video-links
 * Add or replace video links for a player. Coach must belong to the player's program.
 * Body: { playerId: string, programId: string, links: Array<{ videoType: string, url: string, sortOrder?: number }> }
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
      links: Array<{ videoType: string; url: string; sortOrder?: number }>
    }

    const { playerId, programId, links } = body
    if (!playerId || !programId || !Array.isArray(links)) {
      return NextResponse.json({ error: "playerId, programId, and links array are required" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("program_id")
      .eq("id", (player as { team_id: string }).team_id)
      .maybeSingle()

    if (!team || (team as { program_id?: string }).program_id !== programId) {
      return NextResponse.json({ error: "Player is not in this program" }, { status: 400 })
    }

    const validLinks = links
      .filter((l) => l?.url && typeof l.url === "string" && l.url.trim() && VIDEO_TYPES.includes((l.videoType as string) as (typeof VIDEO_TYPES)[number]))
      .map((l, i) => ({
        player_id: playerId,
        video_type: (l.videoType as string).trim().toLowerCase(),
        url: (l.url as string).trim(),
        sort_order: typeof l.sortOrder === "number" ? l.sortOrder : i,
      }))

    if (validLinks.length === 0) {
      return NextResponse.json({ error: "No valid links provided" }, { status: 400 })
    }

    await supabase.from("player_video_links").delete().eq("player_id", playerId)

    if (validLinks.length > 0) {
      const { error } = await supabase.from("player_video_links").insert(validLinks)
      if (error) {
        console.error("[POST /api/recruiting/video-links]", error)
        return NextResponse.json({ error: "Failed to save video links" }, { status: 500 })
      }
    }

    const { data: inserted } = await supabase
      .from("player_video_links")
      .select("id, video_type, url, sort_order")
      .eq("player_id", playerId)
      .order("sort_order")

    return NextResponse.json({
      links: (inserted ?? []).map((r) => ({
        id: r.id,
        videoType: (r as { video_type: string }).video_type,
        url: (r as { url: string }).url,
        sortOrder: (r as { sort_order: number }).sort_order,
      })),
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/recruiting/video-links]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
