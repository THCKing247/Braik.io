import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/messages/threads?teamId=xxx
 * Returns threads for the team that the current user is a participant in.
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

    // Get threads where user is a participant
    const { data: participantThreads, error: participantError } = await supabase
      .from("message_thread_participants")
      .select("thread_id")
      .eq("user_id", session.user.id)

    if (participantError) {
      console.error("[GET /api/messages/threads] participants", participantError)
      return NextResponse.json({ error: "Failed to load threads" }, { status: 500 })
    }

    const threadIds = (participantThreads ?? []).map((p) => p.thread_id)
    if (threadIds.length === 0) {
      return NextResponse.json([])
    }

    // Get threads with creator info
    const { data: threads, error: threadsError } = await supabase
      .from("message_threads")
      .select("id, title, thread_type, created_by, created_at, updated_at")
      .eq("team_id", teamId)
      .in("id", threadIds)
      .order("updated_at", { ascending: false })

    if (threadsError) {
      console.error("[GET /api/messages/threads] threads", threadsError)
      return NextResponse.json({ error: "Failed to load threads" }, { status: 500 })
    }

    // Get creator user info
    const creatorIds = [...new Set((threads ?? []).map((t) => t.created_by))]
    let creatorMap = new Map<string, { id: string; name: string | null; email: string }>()
    if (creatorIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", creatorIds)
      creatorMap = new Map((users ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))
    }

    // Get participant counts and last message info
    const { data: messageCounts } = await supabase
      .from("messages")
      .select("thread_id")
      .in("thread_id", threadIds)

    const countMap = new Map<string, number>()
    ;(messageCounts ?? []).forEach((m) => {
      countMap.set(m.thread_id, (countMap.get(m.thread_id) || 0) + 1)
    })

    // Get participants for each thread
    const { data: allParticipants } = await supabase
      .from("message_thread_participants")
      .select("thread_id, user_id")
      .in("thread_id", threadIds)

    const participantsByThread = new Map<string, string[]>()
    ;(allParticipants ?? []).forEach((p) => {
      const existing = participantsByThread.get(p.thread_id) || []
      participantsByThread.set(p.thread_id, [...existing, p.user_id])
    })

    // Get participant user details
    const allParticipantUserIds = [...new Set((allParticipants ?? []).map((p) => p.user_id))]
    const { data: participantUsers } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", allParticipantUserIds)

    const participantUserMap = new Map((participantUsers ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))

    // Format response
    const formatted = (threads ?? []).map((t) => {
      const creator = creatorMap.get(t.created_by) || { id: t.created_by, name: null, email: "" }
      const participantIds = participantsByThread.get(t.id) || []
      const participants = participantIds.map((uid) => {
        const user = participantUserMap.get(uid)
        return user ? { id: user.id, userId: user.id, user, readOnly: false } : null
      }).filter(Boolean) as Array<{ id: string; userId: string; user: { id: string; name: string | null; email: string }; readOnly: boolean }>

      return {
        id: t.id,
        subject: t.title,
        threadType: t.thread_type.toUpperCase(),
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        creator,
        participants,
        messages: [],
        _count: { messages: countMap.get(t.id) || 0 },
        isReadOnly: false,
        canReply: true,
      }
    })

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error("[GET /api/messages/threads]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load threads" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
