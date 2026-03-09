import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * POST /api/messages/threads/create
 * Creates a new message thread with participants.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      teamId?: string
      subject?: string
      participantUserIds?: string[]
      threadType?: string
    }

    const { teamId, subject, participantUserIds = [], threadType = "group" } = body

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "subject is required" }, { status: 400 })
    }

    if (participantUserIds.length === 0) {
      return NextResponse.json({ error: "At least one participant is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    // Verify all participant user IDs exist
    const { data: participants } = await supabase
      .from("users")
      .select("id")
      .in("id", [...participantUserIds, session.user.id])

    const validParticipantIds = (participants ?? []).map((p) => p.id)
    const allParticipantIds = [...new Set([...validParticipantIds, session.user.id])]

    // Create thread
    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .insert({
        team_id: teamId,
        title: subject.trim(),
        thread_type: threadType.toLowerCase(),
        created_by: session.user.id,
      })
      .select("id, title, thread_type, created_by, created_at, updated_at")
      .single()

    if (threadError || !thread) {
      console.error("[POST /api/messages/threads/create] thread", threadError)
      return NextResponse.json({ error: "Failed to create thread" }, { status: 500 })
    }

    // Add participants (including creator)
    const participantInserts = allParticipantIds.map((userId) => ({
      thread_id: thread.id,
      user_id: userId,
    }))

    const { error: participantsError } = await supabase
      .from("message_thread_participants")
      .insert(participantInserts)

    if (participantsError) {
      console.error("[POST /api/messages/threads/create] participants", participantsError)
      // Clean up thread if participants insert fails
      await supabase.from("message_threads").delete().eq("id", thread.id)
      return NextResponse.json({ error: "Failed to add participants" }, { status: 500 })
    }

    // Get creator info
    const { data: creator } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", session.user.id)
      .maybeSingle()

    // Get participant user info
    const { data: participantUsers } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", allParticipantIds)

    const formattedParticipants = (participantUsers ?? []).map((u) => ({
      id: `${thread.id}-${u.id}`,
      userId: u.id,
      user: { id: u.id, name: u.name ?? null, email: u.email ?? "" },
      readOnly: false,
    }))

    return NextResponse.json({
      id: thread.id,
      subject: thread.title,
      threadType: thread.thread_type.toUpperCase(),
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : { id: session.user.id, name: null, email: "" },
      participants: formattedParticipants,
      messages: [],
      _count: { messages: 0 },
      isReadOnly: false,
      canReply: true,
    })
  } catch (error: any) {
    console.error("[POST /api/messages/threads/create]", error)
    return NextResponse.json(
      { error: error.message || "Failed to create thread" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
