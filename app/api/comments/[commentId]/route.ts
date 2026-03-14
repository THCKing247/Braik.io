import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * PATCH /api/comments/[commentId]
 * Update resolved or text. Body: { resolved?: boolean, text?: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { commentId } = await params
    if (!commentId) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 })
    }

    const body = (await request.json()).catch(() => ({})) as { resolved?: boolean; text?: string }

    const supabase = getSupabaseServer()

    const { data: existing, error: fetchError } = await supabase
      .from("playbook_comments")
      .select("id, team_id, author_id, text, resolved, created_at, updated_at")
      .eq("id", commentId)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    await requireTeamAccess(existing.team_id)

    const update: { resolved?: boolean; text?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (typeof body.resolved === "boolean") update.resolved = body.resolved
    if (typeof body.text === "string" && body.text.trim()) update.text = body.text.trim()

    const { data: row, error } = await supabase
      .from("playbook_comments")
      .update(update)
      .eq("id", commentId)
      .select("id, team_id, parent_type, parent_id, author_id, text, resolved, created_at, updated_at")
      .single()

    if (error) {
      console.error("[PATCH /api/comments/[commentId]]", error)
      return NextResponse.json({ error: "Failed to update comment" }, { status: 500 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", row.author_id)
      .maybeSingle()

    return NextResponse.json({
      id: row.id,
      teamId: row.team_id,
      parentType: row.parent_type,
      parentId: row.parent_id,
      authorId: row.author_id,
      authorName: (profile?.full_name as string) ?? "Coach",
      text: row.text,
      resolved: row.resolved,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[PATCH /api/comments/[commentId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to update comment" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/comments/[commentId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { commentId } = await params
    if (!commentId) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: existing } = await supabase
      .from("playbook_comments")
      .select("id, team_id")
      .eq("id", commentId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    const { requireTeamAccess } = await import("@/lib/auth/rbac")
    await requireTeamAccess(existing.team_id)

    const { error } = await supabase.from("playbook_comments").delete().eq("id", commentId)

    if (error) {
      console.error("[DELETE /api/comments/[commentId]]", error)
      return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[DELETE /api/comments/[commentId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete comment" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
