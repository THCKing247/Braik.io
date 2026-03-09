"use client"

import { useEffect, useState } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { DocumentsManager } from "@/components/portal/documents-manager"

export default function DocumentsPage() {
  return (
    <DashboardPageShell>
      {({ teamId, userRole, canEdit }) => (
        <DocumentsPageContent teamId={teamId} userRole={userRole} canEdit={canEdit} />
      )}
    </DashboardPageShell>
  )
}

function DocumentsPageContent({
  teamId,
  userRole,
  canEdit,
}: {
  teamId: string
  userRole: string
  canEdit: boolean
}) {
  const [documents, setDocuments] = useState<Array<{ id: string; title: string; fileName: string; category: string; folder: string | null; visibility: string; scopedUnit: string | null; scopedPositionGroups: unknown; assignedPlayerIds: unknown; createdAt: string; creator: { name: string | null; email: string }; acknowledgements: Array<{ id: string }> }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/documents?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setDocuments(data.map((d: { createdAt: string }) => ({ ...d, createdAt: new Date(d.createdAt) as unknown as string })))
        }
      })
      .catch(() => {
        if (!cancelled) setDocuments([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [teamId])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  const docsWithDate = documents.map((d) => ({
    ...d,
    createdAt: typeof d.createdAt === "string" ? new Date(d.createdAt) : d.createdAt,
  }))

  return (
    <DocumentsManager
      teamId={teamId}
      documents={docsWithDate}
      canUpload={canEdit}
      userRole={userRole}
    />
  )
}
