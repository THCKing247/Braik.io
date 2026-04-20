import { ParentPortalMessages } from "@/components/portal/parent-portal/parent-portal-messages"

export default function ParentPortalMessagesThreadPage({ params }: { params: { messageId: string } }) {
  return (
    <>
      <h1 className="sr-only">Message thread</h1>
      <ParentPortalMessages routeThreadId={params.messageId} />
    </>
  )
}
