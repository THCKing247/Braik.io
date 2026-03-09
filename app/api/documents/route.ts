import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/documents?teamId=xxx
 * Returns documents for the team. Shape matches DocumentsManager.
 */
export async function GET(request: Request) {
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

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const { data: rows, error } = await supabase
      .from("documents")
      .select("id, title, file_name, category, folder, visibility, scoped_unit, scoped_position_groups, assigned_player_ids, created_by, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[GET /api/documents]", error.message, error)
      return NextResponse.json(
        { error: "Failed to load documents" },
        { status: 500 }
      )
    }

    const creatorIds = [...new Set((rows ?? []).map((r) => r.created_by))]
    let creatorMap = new Map<string, { name: string | null; email: string }>()
    if (creatorIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", creatorIds)
      creatorMap = new Map((users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }]))
    }

    const docIds = (rows ?? []).map((r) => r.id)
    let acksMap = new Map<string, Array<{ id: string }>>()
    if (docIds.length > 0) {
      const { data: acks } = await supabase
        .from("document_acknowledgements")
        .select("id, document_id")
        .in("document_id", docIds)
      acks?.forEach((a) => {
        const list = acksMap.get(a.document_id) ?? []
        list.push({ id: a.id })
        acksMap.set(a.document_id, list)
      })
    }

    const documents = (rows ?? []).map((d) => {
      const creator = creatorMap.get(d.created_by)
      return {
        id: d.id,
        title: d.title ?? "",
        fileName: d.file_name ?? "",
        category: d.category ?? "other",
        folder: d.folder ?? null,
        visibility: d.visibility ?? "all",
        scopedUnit: d.scoped_unit ?? null,
        scopedPositionGroups: d.scoped_position_groups ?? null,
        assignedPlayerIds: d.assigned_player_ids ?? null,
        createdAt: d.created_at,
        creator: creator ? { name: creator.name, email: creator.email } : { name: null, email: "" },
        acknowledgements: acksMap.get(d.id) ?? [],
      }
    })

    return NextResponse.json(documents)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/documents - Upload document (stub; full upload may use FormData)
 */
export async function POST() {
  return NextResponse.json(
    { error: "Document upload not yet migrated. Use Supabase storage + documents row." },
    { status: 501 }
  )
}
