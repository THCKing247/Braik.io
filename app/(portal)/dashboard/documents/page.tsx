"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

const DocumentsManager = dynamic(
  () => import("@/components/portal/documents-manager").then((m) => m.DocumentsManager),
  { loading: () => <div className="min-h-[45vh] w-full animate-pulse rounded-xl bg-muted" aria-hidden /> }
)

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
  type DocItem = {
    id: string
    title: string
    fileName: string
    category: string
    folder: string | null
    visibility: string
    scopedUnit: string | null
    scopedPositionGroups: unknown
    assignedPlayerIds: unknown
    createdAt: string
    creator: { name: string | null; email: string }
    acknowledgements: Array<{ id: string }>
  }
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [listLoading, setListLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    fetch(`/api/documents?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          setDocuments(data as DocItem[])
        }
      })
      .catch(() => {
        if (!cancelled) setDocuments([])
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

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
      listLoading={listLoading}
    />
  )
}
