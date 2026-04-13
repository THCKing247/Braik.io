import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { playerFacingStatus, type StudyAssignmentType } from "@/lib/study-assignment-logic"

/**
 * GET — player's assignments: active (default) or archived, lightweight (no items / questions).
 * Query: scope=active|archive, limit (archive), offset (archive)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const session = await getServerSession()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { membership } = await requireTeamAccess(teamId)
    if (canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Use coach assignments API" }, { status: 400 })
    }

    const url = new URL(request.url)
    const scope = url.searchParams.get("scope") === "archive" ? "archive" : "active"
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20))
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0)

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!player) return NextResponse.json({ assignments: [], scope, nextOffset: null })

    const { data: links } = await supabase
      .from("study_assignment_players")
      .select(
        "assignment_id, status, score_percent, opened_at, review_completed_at, quiz_submitted_at, time_spent_seconds, completed_at"
      )
      .eq("player_id", player.id)

    const linkList = links ?? []
    const ids = [...new Set(linkList.map((l) => l.assignment_id))]
    if (ids.length === 0) return NextResponse.json({ assignments: [], scope, nextOffset: null })

    const { data: assigns } = await supabase
      .from("study_assignments")
      .select("id, title, due_date, assignment_type, publish_status")
      .eq("team_id", teamId)
      .eq("publish_status", "published")
      .in("id", ids)

    const assignMap = new Map((assigns ?? []).map((a) => [a.id, a]))
    const linkMap = new Map(linkList.map((l) => [l.assignment_id, l]))

    type Row = {
      id: string
      title: string
      due_date: string | null
      assignment_type: StudyAssignmentType
      myStatus: string
      displayStatus: string
      score_percent: number | null
      opened_at: string | null
      review_completed_at: string | null
      quiz_submitted_at: string | null
    }

    const rows: Row[] = []
    for (const id of ids) {
      const a = assignMap.get(id)
      const l = linkMap.get(id)
      if (!a || !l) continue
      const assignmentType = (a.assignment_type ?? "review") as StudyAssignmentType
      const displayStatus = playerFacingStatus({
        assignmentType,
        dueDate: a.due_date as string | null,
        openedAt: l.opened_at as string | null,
        reviewCompletedAt: l.review_completed_at as string | null,
        quizSubmittedAt: l.quiz_submitted_at as string | null,
        scorePercent: l.score_percent as number | null,
      })
      rows.push({
        id: a.id,
        title: a.title as string,
        due_date: a.due_date as string | null,
        assignment_type: assignmentType,
        myStatus: l.status as string,
        displayStatus,
        score_percent: l.score_percent as number | null,
        opened_at: l.opened_at as string | null,
        review_completed_at: l.review_completed_at as string | null,
        quiz_submitted_at: l.quiz_submitted_at as string | null,
      })
    }

    if (scope === "archive") {
      const completed = rows.filter((r) => r.myStatus === "completed")
      completed.sort((a, b) => {
        const ta = a.quiz_submitted_at || a.review_completed_at || ""
        const tb = b.quiz_submitted_at || b.review_completed_at || ""
        return tb.localeCompare(ta)
      })
      const page = completed.slice(offset, offset + limit)
      const nextOffset = offset + page.length < completed.length ? offset + limit : null
      return NextResponse.json({ assignments: page, scope, nextOffset })
    }

    const active = rows.filter((r) => r.myStatus !== "completed")
    active.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

    return NextResponse.json({ assignments: active, scope, nextOffset: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
