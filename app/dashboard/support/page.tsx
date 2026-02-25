import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SupportTicketForm } from "@/components/support-ticket-form"

export default async function DashboardSupportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { teamId: true, team: { select: { name: true } } },
  })

  if (!membership) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#212529]">Support</h1>
        <p className="mt-3 text-sm text-[#495057]">Join a team first to submit support tickets.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#212529]">Support Ticket</h1>
      <p className="mt-1 text-sm text-[#495057]">
        Team: {membership.team.name}. Admin replies and status updates go to your Head Coach.
      </p>
      <div className="mt-4 max-w-2xl rounded-xl border border-[#e5e7eb] bg-white p-4">
        <SupportTicketForm teamId={membership.teamId} />
      </div>
    </div>
  )
}
