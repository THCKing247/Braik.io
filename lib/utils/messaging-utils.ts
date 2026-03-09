import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * Ensure a general chat thread exists for the team.
 * Returns the thread ID.
 */
export async function ensureGeneralChatThread(teamId: string): Promise<string> {
  const supabase = getSupabaseServer()

  // Check if general chat thread exists
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .eq("team_id", teamId)
    .eq("thread_type", "general")
    .maybeSingle()

  if (existing) {
    return existing.id
  }

  // Get team members to add as participants
  const { data: members } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("active", true)

  if (!members || members.length === 0) {
    throw new Error("Team has no members")
  }

  // Use first member as creator (or get head coach if available)
  const headCoach = members.find((m) => m.user_id) // Simplified - should check role
  const creatorId = headCoach?.user_id || members[0].user_id

  // Create general chat thread
  const { data: thread, error: threadError } = await supabase
    .from("message_threads")
    .insert({
      team_id: teamId,
      title: "General Chat",
      thread_type: "general",
      created_by: creatorId,
    })
    .select("id")
    .single()

  if (threadError || !thread) {
    throw new Error(`Failed to create general chat thread: ${threadError?.message}`)
  }

  // Add all team members as participants
  const participantInserts = members.map((m) => ({
    thread_id: thread.id,
    user_id: m.user_id,
  }))

  const { error: participantsError } = await supabase
    .from("message_thread_participants")
    .insert(participantInserts)

  if (participantsError) {
    // Clean up thread if participants insert fails
    await supabase.from("message_threads").delete().eq("id", thread.id)
    throw new Error(`Failed to add participants: ${participantsError.message}`)
  }

  return thread.id
}

/**
 * Ensure a parent-player-coach chat thread exists.
 * Returns the thread ID.
 */
export async function ensureParentPlayerCoachChat(
  teamId: string,
  parentUserId: string,
  playerId: string
): Promise<string> {
  const supabase = getSupabaseServer()

  // Get player's user_id from players table
  const { data: player } = await supabase
    .from("players")
    .select("user_id")
    .eq("id", playerId)
    .eq("team_id", teamId)
    .maybeSingle()

  if (!player || !player.user_id) {
    throw new Error("Player not found or not linked to an account")
  }

  const playerUserId = player.user_id

  // Get head coach for the team
  const { data: headCoach } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "HEAD_COACH")
    .eq("active", true)
    .maybeSingle()

  if (!headCoach) {
    throw new Error("Team has no head coach")
  }

  const coachUserId = headCoach.user_id

  // Check if thread already exists
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .eq("team_id", teamId)
    .eq("thread_type", "parent_player_coach")
    .maybeSingle()

  // Check participants match
  if (existing) {
    const { data: participants } = await supabase
      .from("message_thread_participants")
      .select("user_id")
      .eq("thread_id", existing.id)

    const participantIds = (participants ?? []).map((p) => p.user_id)
    const requiredIds = [parentUserId, playerUserId, coachUserId]
    const hasAll = requiredIds.every((id) => participantIds.includes(id))

    if (hasAll && participantIds.length === 3) {
      return existing.id
    }
  }

  // Create new thread
  const { data: thread, error: threadError } = await supabase
    .from("message_threads")
    .insert({
      team_id: teamId,
      title: "Parent-Player-Coach Chat",
      thread_type: "parent_player_coach",
      created_by: parentUserId,
    })
    .select("id")
    .single()

  if (threadError || !thread) {
    throw new Error(`Failed to create chat thread: ${threadError?.message}`)
  }

  // Add participants
  const { error: participantsError } = await supabase
    .from("message_thread_participants")
    .insert([
      { thread_id: thread.id, user_id: parentUserId },
      { thread_id: thread.id, user_id: playerUserId },
      { thread_id: thread.id, user_id: coachUserId },
    ])

  if (participantsError) {
    await supabase.from("message_threads").delete().eq("id", thread.id)
    throw new Error(`Failed to add participants: ${participantsError.message}`)
  }

  return thread.id
}
