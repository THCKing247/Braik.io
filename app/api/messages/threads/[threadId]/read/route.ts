import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * POST /api/messages/threads/[threadId]/read
 * Marks a thread as read by updating last_read_at for the current user
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { threadId } = await params
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Verify user is a participant
    const { data: participant } = await supabase
      .from("message_thread_participants")
      .select("user_id")
      .eq("thread_id", threadId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ error: "Not a participant in this thread" }, { status: 403 })
    }

    // Update last_read_at to current timestamp
    const { error: updateError } = await supabase
      .from("message_thread_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .eq("user_id", session.user.id)

    if (updateError) {
      console.error("[POST /api/messages/threads/[threadId]/read]", updateError)
      return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[POST /api/messages/threads/[threadId]/read]", error)
    return NextResponse.json(
      { error: error.message || "Failed to mark as read" },
      { status: 500 }
    )
  }
}
