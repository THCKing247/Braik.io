import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import crypto from "crypto"
import { auditImpersonatedActionFromRequest } from "@/lib/admin/impersonation"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/enforcement/team-operation-guard"
import { sendTeamInviteEmail } from "@/lib/email/braik-emails"
import { buildTeamInviteAcceptUrl } from "@/lib/invites/team-invite-link"

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, email, role } = await request.json()
    const normalizedEmail = String(email ?? "").trim().toLowerCase()
    if (!normalizedEmail || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")
    await requireTeamOperationAccess(teamId, "write")
    await auditImpersonatedActionFromRequest(request, "invite_create", { teamId, email: normalizedEmail, role })

    const supabase = getSupabaseServer()

    const { data: existingUser } = await supabase.from("users").select("id").eq("email", normalizedEmail).maybeSingle()
    if (existingUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", existingUser.id)
        .maybeSingle()
      if (profile?.team_id === teamId) {
        return NextResponse.json({ error: "User is already a member of this team" }, { status: 400 })
      }
    }

    const { data: existingInvite } = await supabase
      .from("invites")
      .select("id")
      .eq("team_id", teamId)
      .eq("email", normalizedEmail)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json({ error: "An active invite already exists for this email" }, { status: 400 })
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .insert({
        team_id: teamId,
        email: normalizedEmail,
        role,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: session.user.id,
      })
      .select()
      .single()

    if (inviteError || !invite) {
      throw new Error(inviteError?.message ?? "Failed to create invite")
    }

    const { writeAuditLog } = await import("@/lib/audit/write-audit-log")
    await writeAuditLog({
      actorUserId: session.user.id,
      teamId,
      actionType: "invite_sent",
      targetType: "invite",
      targetId: invite.id,
      metadata: { email: normalizedEmail, role },
    })

    const { data: teamRow } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
    const teamName = (teamRow as { name?: string } | null)?.name?.trim() || "Your team"
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .maybeSingle()
    const inviterName =
      (inviterProfile as { full_name?: string | null } | null)?.full_name?.trim() || null

    const inviteUrl = buildTeamInviteAcceptUrl(token)
    sendTeamInviteEmail({
      to: normalizedEmail,
      teamName,
      role: String(role),
      inviteUrl,
      inviterName,
      metadata: { teamId, inviteId: String(invite.id) },
    })
      .then((emailResult) => {
        if (!emailResult.ok) {
          console.error("[POST /api/invites] Postmark team invite email failed:", emailResult.error)
        }
      })
      .catch((err: unknown) => {
        console.error("[POST /api/invites] Postmark team invite email threw:", err instanceof Error ? err.message : err)
      })

    return NextResponse.json(invite)
  } catch (error: unknown) {
    if (error instanceof TeamOperationBlockedError) {
      return NextResponse.json(toStructuredTeamAccessError(error), { status: error.statusCode })
    }
    if (error instanceof MembershipLookupError) {
      console.error("[POST /api/invites] membership lookup failed (DB/schema)", error.message)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
    console.error("Invite error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
