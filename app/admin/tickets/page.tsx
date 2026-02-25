import { AdminTicketMessageForm } from "@/components/admin-ticket-message-form"
import { AdminTicketStatusForm } from "@/components/admin-ticket-status-form"
import { prisma } from "@/lib/prisma"

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string }
}) {
  const query = searchParams?.q?.trim() || ""
  const status = searchParams?.status?.trim() || ""

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { subject: { contains: query, mode: "insensitive" } },
              { team: { name: { contains: query, mode: "insensitive" } } },
              { createdByUser: { email: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      team: { select: { name: true } },
      createdByUser: { select: { email: true, name: true } },
      headCoachUser: { select: { email: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { senderAdmin: { select: { email: true } } },
      },
    },
  })

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Support Tickets</h2>
      <form className="grid gap-2 md:grid-cols-[1fr_auto_auto]" method="get">
        <input
          name="q"
          defaultValue={query}
          className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm"
          placeholder="Search tickets"
        />
        <select name="status" defaultValue={status} className="rounded border border-white/20 bg-black/20 px-3 py-2 text-sm">
          <option value="">Any status</option>
          <option value="NEW">NEW</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="WAITING">WAITING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <button className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-black">Filter</button>
      </form>

      <div className="space-y-3">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">
                  {ticket.subject} <span className="text-xs text-white/60">({ticket.team.name})</span>
                </h3>
                <p className="text-xs text-white/70">
                  Reporter: {ticket.createdByUser.name || ticket.createdByUser.email} | Head Coach:{" "}
                  {ticket.headCoachUser.name || ticket.headCoachUser.email}
                </p>
                <p className="mt-1 text-xs text-white/70">Priority: {ticket.priority || "normal"}</p>
              </div>
              <AdminTicketStatusForm ticketId={ticket.id} initialStatus={ticket.status} />
            </div>

            <p className="mt-3 rounded border border-white/10 bg-black/20 p-2 text-sm">{ticket.originalMessage}</p>
            <AdminTicketMessageForm ticketId={ticket.id} />

            {ticket.messages.length > 0 ? (
              <div className="mt-3 space-y-1">
                {ticket.messages.map((message) => (
                  <p key={message.id} className="text-xs text-white/75">
                    Admin ({message.senderAdmin.email}): {message.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
