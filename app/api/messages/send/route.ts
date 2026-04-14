import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { createNotifications } from "@/lib/utils/notifications"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"
import {
  ensureUserThreadParticipant,
  repairThreadParticipantsFromThreadAndMessages,
} from "@/lib/messaging/thread-participants"

/**
 * POST /api/messages/send
 * Sends a message to a thread.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: {
      threadId?: string
      body?: string
      attachments?: Array<{ id?: string; fileName?: string; fileUrl?: string }> | null
    }
    
    try {
      body = await request.json()
    } catch (error) {
      console.error("[POST /api/messages/send] JSON parse error:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { threadId, body: messageBody, attachments = [] } = body
    const attachmentArray = Array.isArray(attachments) ? attachments : (attachments ? [attachments] : [])

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 })
    }

    if (!messageBody || !messageBody.trim()) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Get thread to verify access
    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .select("id, team_id")
      .eq("id", threadId)
      .maybeSingle()

    if (threadError || !thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const repair = await repairThreadParticipantsFromThreadAndMessages(
      supabase,
      threadId,
      [session.user.id],
      "send:repairThreadParticipantsFromThreadAndMessages"
    )
    if (repair.error) {
      return NextResponse.json({ error: "Failed to sync thread participants" }, { status: 500 })
    }

    let { data: participant, error: participantError } = await supabase
      .from("message_thread_participants")
      .select("user_id")
      .eq("thread_id", threadId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (participantError) {
      console.error("[POST /api/messages/send] participant lookup error:", participantError)
      return NextResponse.json({ error: "Failed to verify thread access" }, { status: 500 })
    }

    if (!participant) {
      try {
        await requireTeamAccess(thread.team_id)
      } catch {
        return NextResponse.json(
          { error: "Access denied: You are not a participant in this thread and not a team member" },
          { status: 403 }
        )
      }
      const grant = await ensureUserThreadParticipant(
        supabase,
        threadId,
        session.user.id,
        "send:teamMemberParticipantGrant"
      )
      if (grant.error) {
        return NextResponse.json({ error: "Failed to add you to this thread" }, { status: 500 })
      }
      const again = await supabase
        .from("message_thread_participants")
        .select("user_id")
        .eq("thread_id", threadId)
        .eq("user_id", session.user.id)
        .maybeSingle()
      participant = again.data
    }

    if (!participant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    console.info("[POST /api/messages/send] participant ok", {
      threadId,
      userId: session.user.id,
      teamId: thread.team_id,
    })

    // Verify sender_id exists in users table (required for FK constraint)
    const { data: senderCheck, error: senderCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("id", session.user.id)
      .maybeSingle()

    if (senderCheckError) {
      console.error("[POST /api/messages/send] sender check error:", senderCheckError)
      return NextResponse.json({ error: "Failed to verify sender account" }, { status: 500 })
    }

    if (!senderCheck) {
      console.error("[POST /api/messages/send] sender not found in users table:", session.user.id)
      return NextResponse.json({ 
        error: "Your account is not properly set up. Please contact support." 
      }, { status: 500 })
    }

    // Create message
    console.log("[POST /api/messages/send] Inserting message:", {
      threadId,
      senderId: session.user.id,
      contentLength: messageBody.trim().length
    })

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_id: session.user.id,
        content: messageBody.trim(),
      })
      .select("id, sender_id, content, created_at, updated_at")
      .single()

    if (messageError) {
      console.error("[POST /api/messages/send] message insert error:", {
        error: messageError,
        code: messageError.code,
        message: messageError.message,
        details: messageError.details,
        hint: messageError.hint
      })
      return NextResponse.json({ 
        error: "Failed to send message", 
        details: messageError.message,
        code: messageError.code
      }, { status: 500 })
    }

    if (!message) {
      console.error("[POST /api/messages/send] message insert returned no data")
      return NextResponse.json({ error: "Failed to send message: no data returned" }, { status: 500 })
    }

    console.log("[POST /api/messages/send] Message created successfully:", message.id)

    trackProductEventServer({
      eventName: BRAIK_EVENTS.messaging.message_sent,
      userId: session.user.id,
      teamId: thread.team_id,
      role: session.user.role ?? null,
      metadata: { thread_id: threadId, content_length: messageBody.trim().length },
    })

    const { data: senderRow } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", session.user.id)
      .maybeSingle()

    try {
      const { data: participants } = await supabase
        .from("message_thread_participants")
        .select("user_id")
        .eq("thread_id", threadId)
      const targetIds = (participants ?? [])
        .map((p) => p.user_id)
        .filter((id): id is string => Boolean(id) && id !== session.user.id)
      if (targetIds.length > 0) {
        const snippet =
          messageBody.trim().length > 80
            ? `${messageBody.trim().slice(0, 77)}…`
            : messageBody.trim()
        const senderName = senderRow?.name?.trim() || null
        await createNotifications({
          type: "message",
          teamId: thread.team_id,
          title: "New message",
          body: senderName ? `${senderName}: ${snippet}` : snippet,
          linkType: "message_thread",
          linkId: threadId,
          targetUserIds: targetIds,
        })
      }
    } catch {
      /* non-fatal */
    }

    // Link attachments if provided
    if (attachmentArray.length > 0) {
      // Update existing attachments to link to this message
      const attachmentIds = attachmentArray.filter((a) => a.id).map((a) => a.id!)
      if (attachmentIds.length > 0) {
        const { error: attachError } = await supabase
          .from("message_attachments")
          .update({ message_id: message.id })
          .in("id", attachmentIds)

        if (attachError) {
          console.error("[POST /api/messages/send] attachments update error:", attachError)
          // Non-fatal - message is sent, attachments just not linked
        }
      }
    }

    const sender = senderRow

    // Get message attachments
    const { data: messageAttachments } = await supabase
      .from("message_attachments")
      .select("id, file_name, file_url, file_size, mime_type")
      .eq("message_id", message.id)

    return NextResponse.json({
      id: message.id,
      body: message.content,
      attachments: (messageAttachments ?? []).map((att) => ({
        id: att.id,
        fileName: att.file_name,
        fileUrl: att.file_url,
        fileSize: att.file_size,
        mimeType: att.mime_type,
      })),
      createdAt: message.created_at,
      creator: sender ? { id: sender.id, name: sender.name, email: sender.email } : { id: session.user.id, name: null, email: "" },
    })
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || "Unknown error",
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause,
    }
    console.error("[POST /api/messages/send] Unexpected error:", errorDetails)
    
    // Ensure we always return a valid response
    try {
      return NextResponse.json(
        { 
          error: error?.message || "Failed to send message",
          details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
          code: error?.code
        },
        { status: error?.message?.includes("Access denied") ? 403 : 500 }
      )
    } catch (responseError) {
      // If even returning the error fails, log it
      console.error("[POST /api/messages/send] Failed to return error response:", responseError)
      // Return a minimal error response
      return new NextResponse(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
  }
}
