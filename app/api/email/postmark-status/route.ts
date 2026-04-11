import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { getPostmarkConfigStatus } from "@/lib/email/postmark-config"

export const runtime = "nodejs"

/**
 * GET /api/email/postmark-status?teamId=...
 * Server-side Postmark readiness for coach UI (roster email, etc.).
 * Does not expose secrets — only booleans, sender, stream, and missing keys.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const status = getPostmarkConfigStatus()

    return NextResponse.json({
      configured: status.configured,
      fromEmail: status.fromEmail,
      messageStream: status.messageStream,
      missing: status.missing,
      userMessage: status.userMessage,
      hasServerToken: status.hasServerToken,
    })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[GET /api/email/postmark-status] membership lookup failed", err.message)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Internal server error"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/email/postmark-status]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
