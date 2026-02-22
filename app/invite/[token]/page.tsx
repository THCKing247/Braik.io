import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { InviteAcceptance } from "@/components/invite-acceptance"

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({
    where: { token: params.token },
    include: {
      team: {
        include: {
          organization: true,
        },
      },
    },
  })

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Invite</h1>
          <p className="text-text-2">This invite link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  if (invite.acceptedAt) {
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

  const expiresAt = (invite as { expiresAt?: Date | null }).expiresAt
  if (expiresAt != null && new Date(expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invite Expired</h1>
          <p className="text-text-2">This invite link has expired.</p>
        </div>
      </div>
    )
  }

  return <InviteAcceptance invite={invite} />
}
