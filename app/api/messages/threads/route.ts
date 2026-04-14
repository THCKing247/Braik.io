import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"

type InboxStatRow = {
  thread_id: string
  message_count: number | string
  unread_count: number | string
  last_message_id: string | null
  last_message_content: string | null
  last_message_created_at: string | null
  last_sender_id: string | null
}

type ThreadInboxStats = {
  messageCount: number
  unreadCount: number
  lastMessageId: string | null
  lastContent: string | null
  lastCreatedAt: string | null
  lastSenderId: string | null
}

/**
 * GET /api/messages/threads?teamId=xxx
 * Returns threads for the team that the current user is a participant in.
 * Uses DB-side aggregates for counts/unread and latest message (no full message-table scan in Node).
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

    const { data: repairedRows, error: repairError } = await supabase.rpc(
      "repair_missing_message_thread_participants_for_team_user",
      { p_team_id: teamId, p_user_id: userId }
    )
    if (repairError) {
      console.error("[GET /api/messages/threads] repair_missing_message_thread_participants_for_team_user", {
        teamId,
        userId,
        code: repairError.code,
        message: repairError.message,
      })
    } else {
      console.info("[GET /api/messages/threads] participant repair", {
        teamId,
        userId,
        rowsInserted: repairedRows,
      })
    }

    const { data: participantThreads, error: participantError } = await supabase
      .from("message_thread_participants")
      .select("thread_id, last_read_at")
      .eq("user_id", userId)

    if (participantError) {
      console.error("[GET /api/messages/threads] participants", participantError)
      return NextResponse.json({ error: "Failed to load threads" }, { status: 500 })
    }

    const threadIds = [...new Set((participantThreads ?? []).map((p) => p.thread_id))]

    const { data: teamUnreadTotalRaw, error: teamUnreadErr } = await supabase.rpc(
      "messaging_unread_total_for_team_user",
      { p_user_id: userId, p_team_id: teamId }
    )
    let teamTotalUnread = Number(teamUnreadTotalRaw ?? 0)
    if (teamUnreadErr) {
      console.warn("[GET /api/messages/threads] messaging_unread_total_for_team_user (fallback 0)", {
        teamId,
        userId,
        message: teamUnreadErr.message,
        code: teamUnreadErr.code,
      })
      teamTotalUnread = 0
    }

    if (threadIds.length === 0) {
      return NextResponse.json({ threads: [], meta: { totalUnread: teamTotalUnread } })
    }

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
      return NextResponse.json({ threads: [], meta: { totalUnread: teamTotalUnread } })
    }

    const { data: statsRows, error: statsError } = await supabase.rpc("message_threads_inbox_stats", {
      p_user_id: userId,
      p_thread_ids: selectedThreadIds,
    })

    if (statsError) {
      console.error("[GET /api/messages/threads] message_threads_inbox_stats", statsError)
      return NextResponse.json({ error: "Failed to load threads" }, { status: 500 })
    }

    const pageUnreadSum = (statsRows ?? []).reduce(
      (acc, r: InboxStatRow) => acc + Number(r.unread_count ?? 0),
      0
    )
    console.info("[GET /api/messages/threads] inbox_stats", {
      userId,
      teamId,
      threadCount: selectedThreadIds.length,
      pageUnreadSum,
      teamTotalUnread,
      at: new Date().toISOString(),
    })

    const statsByThread = new Map<string, ThreadInboxStats>(
      (statsRows ?? []).map((r: InboxStatRow) => [
        r.thread_id,
        {
          messageCount: Number(r.message_count ?? 0),
          unreadCount: Number(r.unread_count ?? 0),
          lastMessageId: r.last_message_id,
          lastContent: r.last_message_content,
          lastCreatedAt: r.last_message_created_at,
          lastSenderId: r.last_sender_id,
        },
      ])
    )

    const creatorIds = [...new Set((threads ?? []).map((t) => t.created_by))]
    let creatorMap = new Map<string, { id: string; name: string | null; email: string }>()
    if (creatorIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name, email").in("id", creatorIds)
      creatorMap = new Map((users ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))
    }

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

    const { data: profiles } = await supabase.from("profiles").select("id, role").in("id", allParticipantUserIds)

    const profileRoleByUserId = new Map((profiles ?? []).map((p) => [p.id, p.role]))

    function participantKind(uid: string): "player" | "coach" | "parent" | "staff" {
      if (rosterUserIds.has(uid)) return "player"
      const tr = (teamRoleByUserId.get(uid) || "").toUpperCase()
      if (tr.includes("PARENT") || profileRoleByUserId.get(uid)?.toLowerCase() === "parent") return "parent"
      if (tr.includes("COACH") || tr.includes("HEAD") || tr === "HEAD_COACH" || tr === "ASSISTANT_COACH") return "coach"
      return "staff"
    }

    const latestSenderIds = [
      ...new Set(
        (statsRows ?? [])
          .map((r: InboxStatRow) => r.last_sender_id)
          .filter((id): id is string => typeof id === "string" && !!id)
      ),
    ]
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

      const st = statsByThread.get(t.id)
      let messages: Array<{
        id: string
        body: string
        attachments: unknown[]
        createdAt: string
        creator: { id: string; name: string | null; email: string }
      }> = []

      if (st?.lastMessageId && st.lastSenderId) {
        const s = latestSenderMap.get(st.lastSenderId)
        const senderName = s?.name ?? null
        const roster = rosterNameByUserId.get(st.lastSenderId)
        const resolvedName = roster || senderName || s?.email || ""
        messages = [
          {
            id: st.lastMessageId,
            body: st.lastContent ?? "",
            attachments: [],
            createdAt: st.lastCreatedAt ?? t.updated_at,
            creator: {
              id: st.lastSenderId,
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
        unreadCount: st?.unreadCount ?? 0,
        _count: { messages: st?.messageCount ?? 0 },
        isReadOnly: false,
        canReply: true,
      }
    })

    return NextResponse.json({
      threads: formatted,
      meta: {
        /** Sum of unread across all threads in this team (not only this page). */
        totalUnread: teamTotalUnread,
      },
    })
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
