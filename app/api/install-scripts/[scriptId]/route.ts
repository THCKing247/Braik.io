import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

type InstallScriptItemInput = { playId: string }

/**
 * GET /api/install-scripts/[scriptId]
 * Get install script with ordered items (play ids).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { scriptId } = await params
    if (!scriptId) {
      return NextResponse.json({ error: "scriptId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: script, error: scriptError } = await supabase
      .from("install_scripts")
      .select("id, playbook_id, team_id, name, created_at")
      .eq("id", scriptId)
      .maybeSingle()

    if (scriptError || !script) {
      if (!script) return NextResponse.json({ error: "Install script not found" }, { status: 404 })
      console.error("[GET /api/install-scripts/[scriptId]]", scriptError)
      return NextResponse.json({ error: "Failed to load install script" }, { status: 500 })
    }

    await requireTeamAccess(script.team_id)

    const { data: items, error: itemsError } = await supabase
      .from("install_script_items")
      .select("id, script_id, play_id, order_index")
      .eq("script_id", scriptId)
      .order("order_index", { ascending: true })

    if (itemsError) {
      console.error("[GET /api/install-scripts/[scriptId]] items", itemsError)
    }

    const itemsList = (items ?? []).map((r) => ({
      id: r.id,
      scriptId: r.script_id,
      playId: r.play_id,
      orderIndex: r.order_index,
    }))

    return NextResponse.json({
      id: script.id,
      playbookId: script.playbook_id,
      teamId: script.team_id,
      name: script.name,
      createdAt: script.created_at,
      items: itemsList,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/install-scripts/[scriptId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load install script" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/install-scripts/[scriptId]
 * Update script name and/or items (full replace of items).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { scriptId } = await params
    if (!scriptId) {
      return NextResponse.json({ error: "scriptId is required" }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      items?: InstallScriptItemInput[]
    }

    const supabase = getSupabaseServer()

    const { data: existing } = await supabase
      .from("install_scripts")
      .select("id, team_id")
      .eq("id", scriptId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Install script not found" }, { status: 404 })
    }

    await requireTeamAccess(existing.team_id)

    const updates: { name?: string } = {}
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim()

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("install_scripts")
        .update(updates)
        .eq("id", scriptId)
      if (updateError) {
        console.error("[PATCH /api/install-scripts/[scriptId]]", updateError)
        return NextResponse.json({ error: "Failed to update install script" }, { status: 500 })
      }
    }

    if (Array.isArray(body.items)) {
      const { error: delError } = await supabase
        .from("install_script_items")
        .delete()
        .eq("script_id", scriptId)
      if (delError) {
        console.error("[PATCH /api/install-scripts/[scriptId]] delete items", delError)
        return NextResponse.json({ error: "Failed to update script items" }, { status: 500 })
      }

      const seen = new Set<string>()
      const inserts = body.items
        .filter((item) => {
          const id = typeof item?.playId === "string" ? item.playId.trim() : ""
          if (!id || seen.has(id)) return false
          seen.add(id)
          return true
        })
        .map((item, index) => ({
          script_id: scriptId,
          play_id: item!.playId.trim(),
          order_index: index,
        }))

      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from("install_script_items").insert(inserts)
        if (insertError) {
          console.error("[PATCH /api/install-scripts/[scriptId]] insert items", insertError)
          return NextResponse.json({ error: "Failed to save script items" }, { status: 500 })
        }
      }
    }

    const { data: script } = await supabase
      .from("install_scripts")
      .select("id, playbook_id, team_id, name, created_at")
      .eq("id", scriptId)
      .single()

    const { data: items } = await supabase
      .from("install_script_items")
      .select("id, script_id, play_id, order_index")
      .eq("script_id", scriptId)
      .order("order_index", { ascending: true })

    return NextResponse.json({
      id: script?.id,
      playbookId: script?.playbook_id,
      teamId: script?.team_id,
      name: script?.name,
      createdAt: script?.created_at,
      items: (items ?? []).map((r) => ({
        id: r.id,
        scriptId: r.script_id,
        playId: r.play_id,
        orderIndex: r.order_index,
      })),
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[PATCH /api/install-scripts/[scriptId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to update install script" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/install-scripts/[scriptId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { scriptId } = await params
    if (!scriptId) {
      return NextResponse.json({ error: "scriptId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: existing } = await supabase
      .from("install_scripts")
      .select("id, team_id")
      .eq("id", scriptId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Install script not found" }, { status: 404 })
    }

    await requireTeamAccess(existing.team_id)

    const { error } = await supabase.from("install_scripts").delete().eq("id", scriptId)

    if (error) {
      console.error("[DELETE /api/install-scripts/[scriptId]]", error)
      return NextResponse.json({ error: "Failed to delete install script" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[DELETE /api/install-scripts/[scriptId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete install script" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
