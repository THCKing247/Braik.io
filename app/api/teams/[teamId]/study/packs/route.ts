import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const { data: packs, error } = await supabase
      .from("study_packs")
      .select("id, title, description, created_at")
      .eq("team_id", teamId)
      .order("title")

    if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })

    const packList = packs ?? []
    const packIds = packList.map((p) => p.id)
    const itemsByPack = new Map<string, { item_type: string; item_id: string; sort_order: number }[]>()
    if (packIds.length) {
      const { data: allItems } = await supabase
        .from("study_pack_items")
        .select("pack_id, item_type, item_id, sort_order")
        .in("pack_id", packIds)
        .order("sort_order")
      for (const row of allItems ?? []) {
        const pid = row.pack_id as string
        const arr = itemsByPack.get(pid) ?? []
        arr.push({
          item_type: row.item_type as string,
          item_id: row.item_id as string,
          sort_order: row.sort_order as number,
        })
        itemsByPack.set(pid, arr)
      }
    }

    const withItems = packList.map((p) => ({
      ...p,
      items: itemsByPack.get(p.id) ?? [],
    }))

    return NextResponse.json({ packs: withItems })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const auth = await requireTeamAccess(teamId)
    if (!canEditRoster(auth.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as {
      title?: string
      description?: string | null
      items?: { itemType: "playbook" | "install_script" | "formation"; itemId: string }[]
    }

    if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })

    const supabase = getSupabaseServer()
    const { data: pack, error } = await supabase
      .from("study_packs")
      .insert({
        team_id: teamId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        created_by: auth.user.id,
      })
      .select("*")
      .single()

    if (error || !pack) return NextResponse.json({ error: "Failed" }, { status: 500 })

    if (Array.isArray(body.items) && body.items.length > 0) {
      await supabase.from("study_pack_items").insert(
        body.items.map((it, i) => ({
          pack_id: pack.id,
          item_type: it.itemType,
          item_id: it.itemId,
          sort_order: i,
        }))
      )
    }

    return NextResponse.json({ pack })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
