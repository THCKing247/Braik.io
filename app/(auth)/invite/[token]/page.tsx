import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { InviteAcceptCard, type InviteDetails } from "@/components/invites/invite-accept-card"
import { InviteInvalidState } from "@/components/invites/invite-invalid-state"

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = getSupabaseServer()
  const { data: inviteRow } = await supabase
    .from("invites")
    .select("id, email, role, team_id, token, expires_at, accepted_at, school_id, created_by")
    .eq("token", params.token)
    .maybeSingle()

  if (!inviteRow) {
    return <InviteInvalidState reason="not_found" />
  }

  if (inviteRow.accepted_at) {
    return <InviteInvalidState reason="already_accepted" />
  }

  const expiresAt = new Date(inviteRow.expires_at)
  if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return <InviteInvalidState reason="expired" />
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, sport")
    .eq("id", inviteRow.team_id)
    .maybeSingle()

  if (!team) {
    return <InviteInvalidState reason="not_found" />
  }

  let schoolName: string | null = null
  if (inviteRow.school_id) {
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", inviteRow.school_id)
      .maybeSingle()
    schoolName = school?.name ?? null
  }

  let inviterName: string | null = null
  if (inviteRow.created_by) {
    const { data: inviter } = await supabase
      .from("users")
      .select("name")
      .eq("id", inviteRow.created_by)
      .maybeSingle()
    inviterName = inviter?.name ?? null
  }

  const invite: InviteDetails = {
    id: inviteRow.id,
    token: inviteRow.token,
    email: inviteRow.email,
    role: inviteRow.role,
    team: {
      id: team.id,
      name: team.name ?? "",
      sport: (team as { sport?: string }).sport ?? null,
    },
    schoolName,
    inviterName,
    expiresAt: inviteRow.expires_at,
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-4 py-12">
      <InviteAcceptCard invite={invite} />
    </div>
  )
}
