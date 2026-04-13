import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { canViewFundraisingFinancials, isFundraisingModuleRole } from "@/lib/auth/fundraising-access"

type PlayerEmbed = { first_name: string | null; last_name: string | null; position_group: string | null } | null

function normalizePlayerEmbed(raw: unknown): PlayerEmbed {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0] as { first_name?: string | null; last_name?: string | null; position_group?: string | null } | undefined
    if (!first) return null
    return {
      first_name: first.first_name ?? null,
      last_name: first.last_name ?? null,
      position_group: first.position_group ?? null,
    }
  }
  const o = raw as { first_name?: string | null; last_name?: string | null; position_group?: string | null }
  return {
    first_name: o.first_name ?? null,
    last_name: o.last_name ?? null,
    position_group: o.position_group ?? null,
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string; collectionId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { teamId, collectionId } = await params
    if (!teamId || !collectionId) {
      return NextResponse.json({ error: "teamId and collectionId are required" }, { status: 400 })
    }
    await requireTeamAccessWithUser(teamId, session.user)
    const membership = await getUserMembership(teamId)
    if (!membership || !isFundraisingModuleRole(membership) || !canViewFundraisingFinancials(membership)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const supabase = getSupabaseServer()

    const { data: collection, error: cErr } = await supabase
      .from("fundraising_due_collections")
      .select("*")
      .eq("id", collectionId)
      .eq("team_id", teamId)
      .maybeSingle()
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: recRows, error: rErr } = await supabase
      .from("fundraising_due_collection_recipients")
      .select(
        "id, user_id, role_kind, player_id, contribution_status, received_note, updated_at, players ( first_name, last_name, position_group )"
      )
      .eq("collection_id", collectionId)
      .eq("team_id", teamId)
      .order("role_kind", { ascending: true })
      .order("id", { ascending: true })
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

    const rows = recRows ?? []
    const needUserIds = new Set<string>()
    for (const r of rows) {
      const pl = normalizePlayerEmbed(r.players)
      const hasName =
        pl &&
        (String(pl.first_name ?? "").trim() !== "" || String(pl.last_name ?? "").trim() !== "")
      if (!hasName) needUserIds.add(r.user_id as string)
    }

    const userNames = new Map<string, string>()
    if (needUserIds.size > 0) {
      const { data: users, error: uErr } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", [...needUserIds])
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
      for (const u of users ?? []) {
        const label = String((u as { name?: string | null }).name ?? "").trim()
        const email = String((u as { email?: string | null }).email ?? "").trim()
        userNames.set(
          (u as { id: string }).id,
          label || email || "User"
        )
      }
    }

    const recipients = rows.map((r) => {
      const pl = normalizePlayerEmbed(r.players)
      const fn = pl?.first_name?.trim() ?? ""
      const ln = pl?.last_name?.trim() ?? ""
      const fromPlayer = [fn, ln].filter(Boolean).join(" ").trim()
      const displayName = fromPlayer || userNames.get(r.user_id as string) || "User"
      const positionGroup =
        r.role_kind === "player" ? (pl?.position_group?.trim() || null) : null
      return {
        id: r.id,
        user_id: r.user_id,
        role_kind: r.role_kind,
        player_id: r.player_id,
        contribution_status: r.contribution_status,
        received_note: r.received_note,
        updated_at: r.updated_at,
        display_name: displayName,
        position_group: positionGroup,
      }
    })

    return NextResponse.json({ collection, recipients })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[due-collection GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
