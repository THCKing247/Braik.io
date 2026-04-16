import type { SupabaseClient } from "@supabase/supabase-js"

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

export type MessageThreadsInboxPayload = {
  threads: unknown[]
  meta: { totalUnread: number }
}

/**
 * Shared by GET /api/messages/threads and dashboard deferred-core bootstrap.
 */
export async function loadMessageThreadsInboxPayload(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  opts?: { limit?: number; offset?: number }
): Promise<MessageThreadsInboxPayload> {
  const limitRaw = opts?.limit ?? 50
  const offsetRaw = opts?.offset ?? 0
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0

  const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    const started = performance.now()
    try {
      return await fn()
    } finally {
      console.info(
        `[messages-threads] ${label} teamId=${teamId} userId=${userId} ms=${Math.round(performance.now() - started)}`
      )
    }
  }

  const participantsResult = await timed("participants_query", async () => {
    return await supabase
      .from("message_thread_participants")
      .select("thread_id, last_read_at")
      .eq("user_id", userId)
  })
  const { data: participantThreads, error: participantError } = participantsResult

  if (participantError) {
    console.error("[loadMessageThreadsInboxPayload] participants", participantError)
    throw new Error("Failed to load threads")
  }

  const threadIds = [...new Set((participantThreads ?? []).map((p) => p.thread_id))]

  const { data: teamUnreadTotalRaw, error: teamUnreadErr } = await timed("team_unread_count", async () => {
    return await supabase.rpc("messaging_unread_total_for_team_user", {
      p_user_id: userId,
      p_team_id: teamId,
    })
  })
  let teamTotalUnread = Number(teamUnreadTotalRaw ?? 0)
  if (teamUnreadErr) {
    console.warn("[loadMessageThreadsInboxPayload] messaging_unread_total_for_team_user (fallback 0)", {
      teamId,
      userId,
      message: teamUnreadErr.message,
      code: teamUnreadErr.code,
    })
    teamTotalUnread = 0
  }

  if (threadIds.length === 0) {
    return { threads: [], meta: { totalUnread: teamTotalUnread } }
  }

  const { data: threads, error: threadsError } = await timed("threads_query", async () => {
    return await supabase
      .from("message_threads")
      .select("id, title, thread_type, created_by, created_at, updated_at, team_id")
      .eq("team_id", teamId)
      .in("id", threadIds)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)
  })

  if (threadsError) {
    console.error("[loadMessageThreadsInboxPayload] threads", threadsError)
    throw new Error("Failed to load threads")
  }

  const selectedThreadIds = [...new Set((threads ?? []).map((t) => t.id))]
  if (selectedThreadIds.length === 0) {
    return { threads: [], meta: { totalUnread: teamTotalUnread } }
  }

  const { data: statsRows, error: statsError } = await timed("inbox_stats", async () => {
    return await supabase.rpc("message_threads_inbox_stats", {
      p_user_id: userId,
      p_thread_ids: selectedThreadIds,
    })
  })

  if (statsError) {
    console.error("[loadMessageThreadsInboxPayload] message_threads_inbox_stats", statsError)
    throw new Error("Failed to load threads")
  }

  const pageUnreadSum = (statsRows ?? []).reduce(
    (acc, r: InboxStatRow) => acc + Number(r.unread_count ?? 0),
    0
  )
  console.info("[loadMessageThreadsInboxPayload] inbox_stats", {
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

  const { data: allParticipants } = await timed("participants_by_threads_query", async () => {
    return await supabase.from("message_thread_participants").select("thread_id, user_id").in("thread_id", selectedThreadIds)
  })

  const participantsByThread = new Map<string, string[]>()
  ;(allParticipants ?? []).forEach((p) => {
    const existing = participantsByThread.get(p.thread_id) || []
    participantsByThread.set(p.thread_id, [...existing, p.user_id])
  })

  const creatorIds = [...new Set((threads ?? []).map((t) => t.created_by).filter(Boolean))]
  const allParticipantUserIds = [...new Set((allParticipants ?? []).map((p) => p.user_id).filter(Boolean))]
  const latestSenderIds = [
    ...new Set(
      (statsRows ?? [])
        .map((r: InboxStatRow) => r.last_sender_id)
        .filter((id): id is string => typeof id === "string" && !!id)
    ),
  ]

  const allUserIds = [...new Set([...creatorIds, ...allParticipantUserIds, ...latestSenderIds])]

  const allUsersResult =
    allUserIds.length > 0
      ? await timed("users_query", async () => {
          return await supabase.from("users").select("id, name, email").in("id", allUserIds)
        })
      : { data: [] as { id: string; name: string | null; email: string }[] }

  const allUsers = allUsersResult.data ?? []
  const allUserMap = new Map(allUsers.map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))

  const creatorMap = allUserMap
  const participantUserMap = allUserMap
  const latestSenderMap = allUserMap

  const { data: rosterPlayers } = await timed("roster_players_query", async () => {
    return await supabase
      .from("players")
      .select("user_id, first_name, last_name")
      .eq("team_id", teamId)
      .eq("status", "active")
      .not("user_id", "is", null)
  })

  const rosterNameByUserId = new Map<string, string>()
  for (const p of rosterPlayers ?? []) {
    if (!p.user_id) continue
    const dn = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
    if (dn) rosterNameByUserId.set(p.user_id, dn)
  }

  const rosterUserIds = new Set((rosterPlayers ?? []).map((p) => p.user_id).filter(Boolean) as string[])

  const { data: teamMembers } = await timed("team_members_query", async () => {
    return await supabase.from("team_members").select("user_id, role").eq("team_id", teamId).eq("active", true)
  })

  const teamRoleByUserId = new Map((teamMembers ?? []).map((m) => [m.user_id, m.role]))

  const { data: profiles } = await timed("profiles_query", async () => {
    return await supabase.from("profiles").select("id, role").in("id", allParticipantUserIds)
  })

  const profileRoleByUserId = new Map((profiles ?? []).map((p) => [p.id, p.role]))

  function participantKind(uid: string): "player" | "coach" | "parent" | "staff" {
    if (rosterUserIds.has(uid)) return "player"
    const tr = (teamRoleByUserId.get(uid) || "").toUpperCase()
    if (tr.includes("PARENT") || profileRoleByUserId.get(uid)?.toLowerCase() === "parent") return "parent"
    if (tr.includes("COACH") || tr.includes("HEAD") || tr === "HEAD_COACH" || tr === "ASSISTANT_COACH") return "coach"
    return "staff"
  }

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

  return {
    threads: formatted as unknown[],
    meta: {
      totalUnread: teamTotalUnread,
    },
  }
}
