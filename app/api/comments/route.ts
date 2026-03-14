import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

const PARENT_TYPES = ["playbook", "formation", "sub_formation", "play"] as const
type ParentType = (typeof PARENT_TYPES)[number]

async function getTeamIdForParent(
  supabase: ReturnType<typeof getSupabaseServer>,
  parentType: ParentType,
  parentId: string
): Promise<string | null> {
  if (parentType === "playbook") {
    const { data } = await supabase.from("playbooks").select("team_id").eq("id", parentId).maybeSingle()
    return data?.team_id ?? null
  }
  if (parentType === "formation") {
    const { data } = await supabase.from("formations").select("team_id").eq("id", parentId).maybeSingle()
    return data?.team_id ?? null
  }
  if (parentType === "sub_formation") {
    const { data } = await supabase.from("sub_formations").select("team_id").eq("id", parentId).maybeSingle()
    return data?.team_id ?? null
  }
  if (parentType === "play") {
    const { data } = await supabase.from("plays").select("team_id").eq("id", parentId).maybeSingle()
    return data?.team_id ?? null
  }
  return null
}

/**
 * GET /api/comments?parentType=play&parentId=uuid
 * List comments for a parent. Team-scoped.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parentType = searchParams.get("parentType") as ParentType | null
    const parentId = searchParams.get("parentId")

    if (!parentType || !PARENT_TYPES.includes(parentType) || !parentId) {
      return NextResponse.json({ error: "parentType and parentId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const teamId = await getTeamIdForParent(supabase, parentType, parentId)
    if (!teamId) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const { data: rows, error } = await supabase
      .from("playbook_comments")
      .select("id, team_id, parent_type, parent_id, author_id, text, resolved, created_at, updated_at")
      .eq("parent_type", parentType)
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[GET /api/comments]", error)
      return NextResponse.json({ error: "Failed to load comments" }, { status: 500 })
    }

    const authorIds = [...new Set((rows ?? []).map((r) => r.author_id))]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds)

    const nameByAuthor = new Map((profiles ?? []).map((p) => [p.id, (p.full_name as string) || "Coach"]))

    const list = (rows ?? []).map((r) => ({
      id: r.id,
      teamId: r.team_id,
      parentType: r.parent_type,
      parentId: r.parent_id,
      authorId: r.author_id,
      authorName: nameByAuthor.get(r.author_id) ?? "Coach",
      text: r.text,
      resolved: r.resolved,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

    return NextResponse.json(list)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/comments]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load comments" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/comments
 * Create a comment. Body: { parentType, parentId, text, resolved? }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()).catch(() => ({})) as {
      parentType?: string
      parentId?: string
      text?: string
      resolved?: boolean
    }

    const parentType = body.parentType as ParentType | undefined
    const parentId = body.parentId
    const text = typeof body.text === "string" ? body.text.trim() : ""

    if (!parentType || !PARENT_TYPES.includes(parentType) || !parentId) {
      return NextResponse.json({ error: "parentType and parentId are required" }, { status: 400 })
    }
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const teamId = await getTeamIdForParent(supabase, parentType, parentId)
    if (!teamId) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const now = new Date().toISOString()
    const { data: row, error } = await supabase
      .from("playbook_comments")
      .insert({
        team_id: teamId,
        parent_type: parentType,
        parent_id: parentId,
        author_id: session.user.id,
        text,
        resolved: body.resolved ?? false,
        updated_at: now,
      })
      .select("id, team_id, parent_type, parent_id, author_id, text, resolved, created_at, updated_at")
      .single()

    if (error) {
      console.error("[POST /api/comments]", error)
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
    }

    const authorName = session.user.name ?? "Coach"

    return NextResponse.json({
      id: row.id,
      teamId: row.team_id,
      parentType: row.parent_type,
      parentId: row.parent_id,
      authorId: row.author_id,
      authorName,
      text: row.text,
      resolved: row.resolved,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[POST /api/comments]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to create comment" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
