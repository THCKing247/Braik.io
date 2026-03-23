/**
 * PUT — replace per-game player stat rows (coaches). Body: { rows: [{ playerId, stats }] }
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"

type RowIn = { playerId?: string; stats?: Record<string, unknown> }

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ teamId: string; gameId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameId } = await params
    if (!teamId?.trim() || !gameId?.trim()) {
      return NextResponse.json({ error: "teamId and gameId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: game } = await supabase.from("games").select("id").eq("id", gameId).eq("team_id", teamId).maybeSingle()
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const body = (await request.json().catch(() => null)) as { rows?: RowIn[] } | null
    const rows = Array.isArray(body?.rows) ? body!.rows! : []
    const normalized: { playerId: string; stats: Record<string, unknown> }[] = []
    for (const r of rows) {
      const pid = typeof r.playerId === "string" ? r.playerId.trim() : ""
      if (!pid) continue
      const stats = r.stats && typeof r.stats === "object" && !Array.isArray(r.stats) ? r.stats : {}
      normalized.push({ playerId: pid, stats })
    }

    const ids = [...new Set(normalized.map((r) => r.playerId))]
    if (ids.length > 0) {
      const { data: valid, error: vErr } = await supabase.from("players").select("id").eq("team_id", teamId).in("id", ids)
      if (vErr) {
        console.error("[PUT player-game-stats] validate players", vErr)
        return NextResponse.json({ error: "Validation failed" }, { status: 500 })
      }
      const ok = new Set((valid ?? []).map((x) => x.id as string))
      for (const id of ids) {
        if (!ok.has(id)) {
          return NextResponse.json({ error: `Player ${id} is not on this team` }, { status: 400 })
        }
      }
    }

    const { error: delErr } = await supabase.from("player_game_stats").delete().eq("game_id", gameId).eq("team_id", teamId)
    if (delErr) {
      console.error("[PUT player-game-stats] delete", delErr)
      return NextResponse.json({ error: "Failed to update stats" }, { status: 500 })
    }

    if (normalized.length > 0) {
      const insertRows = normalized.map((r) => ({
        team_id: teamId,
        game_id: gameId,
        player_id: r.playerId,
        stats: r.stats,
        updated_at: new Date().toISOString(),
      }))
      const { error: insErr } = await supabase.from("player_game_stats").insert(insertRows)
      if (insErr) {
        console.error("[PUT player-game-stats] insert", insErr)
        return NextResponse.json({ error: "Failed to save stats" }, { status: 500 })
      }
    }

    revalidatePath("/dashboard/schedule")
    revalidatePath("/dashboard")

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[PUT player-game-stats]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
