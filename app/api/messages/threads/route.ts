import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"

/**
 * GET /api/messages/threads?teamId=xxx
 * Returns threads for the team that the current user is a participant in.
 * Includes last message preview, unread counts, roster-based display names, and participant role hints for UI.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const limitRaw = Number.parseInt(searchParams.get("limit") || "50", 10)
    const offsetRaw = Number.parseInt(searchParams.get("offset") || "0", 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServer()
    const { user } = await requireTeamAccessWithUser(teamId, session.user)
    const userId = user.id

    const { data: participantThreads, error: participantError } = await supabase
      .from("message_thread_participants")
      .select("thread_id, last_read_at")
      .eq("user_id", userId)

    if (participantError) {
      console.error("[GET /api/messages/threads] participants", participantError)
      return NextResponse.json({ error: "Failed to load threads" }, { status: 500 })
    }

    const threadIds = [...new Set((participantThreads ?? []).map((p) => p.thread_id))]
    if (threadIds.length === 0) {
      return NextResponse.json([])
    }

    const lastReadByThread = new Map(
      (participantThreads ?? []).map((p) => [p.thread_id, p.last_read_at as string | null])
    )

    const { data: threads, error: threadsError } = await supabase
      .from("message_threads")
      .select("id, title, thread_type, created_by, created_at, updated_at, team_id")
      .eq("team_id", teamId)
      .in("id", threadIds)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (threadsError) {
      console.error("[GET /api/messages/threads] threads", threadsError)
      return NextResponse.json({ error: "Failed to load threads" }, { status: 500 })
    }

    const selectedThreadIds = [...new Set((threads ?? []).map((t) => t.id))]
    if (selectedThreadIds.length === 0) {
      return NextResponse.json([])
    }

    const creatorIds = [...new Set((threads ?? []).map((t) => t.created_by))]
    let creatorMap = new Map<string, { id: string; name: string | null; email: string }>()
    if (creatorIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", creatorIds)
      creatorMap = new Map((users ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))
    }

    const countMap = new Map<string, number>()
    const unreadCounts = new Map<string, number>()
    const { data: messageStatsRows } = await supabase
      .from("messages")
      .select("thread_id, sender_id, created_at")
      .in("thread_id", selectedThreadIds)
      .is("deleted_at", null)
    ;(messageStatsRows ?? []).forEach((m) => {
      countMap.set(m.thread_id, (countMap.get(m.thread_id) ?? 0) + 1)
      if (m.sender_id === userId) return
      const lastReadAt = lastReadByThread.get(m.thread_id)
      if (!lastReadAt || new Date(m.created_at).getTime() > new Date(lastReadAt).getTime()) {
        unreadCounts.set(m.thread_id, (unreadCounts.get(m.thread_id) ?? 0) + 1)
      }
    })

    const { data: allParticipants } = await supabase
      .from("message_thread_participants")
      .select("thread_id, user_id")
      .in("thread_id", selectedThreadIds)

    const participantsByThread = new Map<string, string[]>()
    ;(allParticipants ?? []).forEach((p) => {
      const existing = participantsByThread.get(p.thread_id) || []
      participantsByThread.set(p.thread_id, [...existing, p.user_id])
    })

    const allParticipantUserIds = [...new Set((allParticipants ?? []).map((p) => p.user_id))]
    const { data: participantUsers } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", allParticipantUserIds)

    const participantUserMap = new Map(
      (participantUsers ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }])
    )

    const { data: rosterPlayers } = await supabase
      .from("players")
      .select("user_id, first_name, last_name")
      .eq("team_id", teamId)
      .eq("status", "active")
      .not("user_id", "is", null)

    const rosterNameByUserId = new Map<string, string>()
    for (const p of rosterPlayers ?? []) {
      if (!p.user_id) continue
      const dn = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
      if (dn) rosterNameByUserId.set(p.user_id, dn)
    }

    const rosterUserIds = new Set((rosterPlayers ?? []).map((p) => p.user_id).filter(Boolean) as string[])

    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId)
      .eq("active", true)

    const teamRoleByUserId = new Map((teamMembers ?? []).map((m) => [m.user_id, m.role]))

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, role")
      .in("id", allParticipantUserIds)

    const profileRoleByUserId = new Map((profiles ?? []).map((p) => [p.id, p.role]))

    function participantKind(uid: string): "player" | "coach" | "parent" | "staff" {
      if (rosterUserIds.has(uid)) return "player"
      const tr = (teamRoleByUserId.get(uid) || "").toUpperCase()
      if (tr.includes("PARENT") || profileRoleByUserId.get(uid)?.toLowerCase() === "parent") return "parent"
      if (tr.includes("COACH") || tr.includes("HEAD") || tr === "HEAD_COACH" || tr === "ASSISTANT_COACH") return "coach"
      return "staff"
    }

    const { data: recentMessages } = await supabase
      .from("messages")
      .select("id, thread_id, sender_id, content, created_at")
      .in("thread_id", selectedThreadIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(400)

    const latestByThread = new Map<string, (typeof recentMessages extends (infer R)[] | null ? R : never)>()
    for (const m of recentMessages ?? []) {
      if (!latestByThread.has(m.thread_id)) latestByThread.set(m.thread_id, m)
    }

    const latestSenderIds = [...new Set([...latestByThread.values()].map((m) => m.sender_id))]
    const { data: latestSenders } =
      latestSenderIds.length > 0
        ? await supabase.from("users").select("id, name, email").in("id", latestSenderIds)
        : { data: [] as { id: string; name: string | null; email: string }[] }

    const latestSenderMap = new Map((latestSenders ?? []).map((u) => [u.id, u]))

    const formatted = (threads ?? []).map((t) => {
      const creator = creatorMap.get(t.created_by) || { id: t.created_by, name: null, email: "" }
      const participantIds = participantsByThread.get(t.id) || []
      const participants = participantIds
        .map((uid) => {
          const user = participantUserMap.get(uid)
          if (!user) return null
          const displayName = rosterNameByUserId.get(uid) || user.name || user.email || "Member"
          const kind = participantKind(uid)
          return {
            id: user.id,
            userId: user.id,
            readOnly: false,
            participantKind: kind,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              displayName,
            },
          }
        })
        .filter(Boolean) as Array<{
          id: string
          userId: string
          readOnly: boolean
          participantKind: "player" | "coach" | "parent" | "staff"
          user: { id: string; name: string | null; email: string; displayName: string }
        }>

      const latest = latestByThread.get(t.id)
      let messages: Array<{
        id: string
        body: string
        attachments: unknown[]
        createdAt: string
        creator: { id: string; name: string | null; email: string }
      }> = []

      if (latest) {
        const s = latestSenderMap.get(latest.sender_id)
        const senderName = s?.name ?? null
        const roster = rosterNameByUserId.get(latest.sender_id)
        const resolvedName = roster || senderName || s?.email || ""
        messages = [
          {
            id: latest.id,
            body: latest.content,
            attachments: [],
            createdAt: latest.created_at,
            creator: {
              id: latest.sender_id,
              name: resolvedName || senderName,
              email: s?.email ?? "",
            },
          },
        ]
      }

      return {
        id: t.id,
        subject: t.title,
        threadType: t.thread_type.toUpperCase(),
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        creator,
        participants,
        messages,
        unreadCount: unreadCounts.get(t.id) ?? 0,
        _count: { messages: countMap.get(t.id) || 0 },
        isReadOnly: false,
        canReply: true,
      }
    })

    return NextResponse.json(formatted)
  } catch (error: unknown) {
    console.error("[GET /api/messages/threads]", error)
    const msg = error instanceof Error ? error.message : "Failed to load threads"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Access denied") || msg.includes("Not a member") ? 403 : 500 }
    )
  }
}
