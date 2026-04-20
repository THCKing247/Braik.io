import { PlayerPortalMessages } from "@/components/portal/player-portal/player-portal-messages"

export default function PlayerPortalMessagesThreadPage({ params }: { params: { messageId: string } }) {
  return (
    <>
      <h1 className="sr-only">Message thread</h1>
      <PlayerPortalMessages routeThreadId={params.messageId} />
    </>
  )
}
