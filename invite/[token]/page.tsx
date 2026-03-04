import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { InviteAcceptance } from "@/components/invite-acceptance"

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = getSupabaseServer()
  const { data: inviteRow } = await supabase
    .from("invites")
    .select("id, email, role, team_id, token, expires_at, accepted_at")
    .eq("token", params.token)
    .maybeSingle()

  if (!inviteRow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Invite</h1>
          <p className="text-text-2">This invite link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, org")
    .eq("id", inviteRow.team_id)
    .single()

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Invite</h1>
          <p className="text-text-2">Team not found.</p>
        </div>
      </div>
    )
  }

  const invite = {
    id: inviteRow.id,
    email: inviteRow.email,
    role: inviteRow.role,
    team: {
      id: team.id,
      name: team.name,
      organization: { name: team.org ?? team.name ?? "" },
    },
  }

  if (inviteRow.accepted_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invite Already Accepted</h1>
          <p className="text-text-2">This invite has already been accepted.</p>
          <a href="/login" className="text-primary hover:underline mt-4 inline-block">
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  if (new Date(inviteRow.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invite Expired</h1>
          <p className="text-text-2">This invite has expired. Please request a new invite.</p>
        </div>
      </div>
    )
  }

  return <InviteAcceptance invite={invite} />
}
