"use client"

import { useEffect, useState } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { DocumentsManager } from "@/components/portal/documents-manager"
import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"

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

  const dashQ = useDashboardBootstrapQuery(teamId)
  const bootstrapCoreReady = dashQ.data ? dashQ.data.deferredPending === false : false
  const teamDocumentsList = bootstrapCoreReady ? dashQ.data?.teamDocumentsList : undefined

  const [documents, setDocuments] = useState<DocItem[]>([])
  const [listLoading, setListLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return

    if (!bootstrapCoreReady) {
      setListLoading(true)
      return
    }

    if (teamDocumentsList !== undefined) {
      const mapped: DocItem[] = teamDocumentsList.map((d) => ({
        ...d,
        createdAt:
          typeof d.createdAt === "string"
            ? d.createdAt
            : (d.createdAt as unknown as Date)?.toISOString?.() ?? String(d.createdAt),
      }))
      setDocuments(mapped)
      setListLoading(false)
      return
    }

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
  }, [teamId, bootstrapCoreReady, teamDocumentsList])

  const docsWithDate = documents.map((d) => ({
    ...d,
    createdAt: typeof d.createdAt === "string" ? new Date(d.createdAt) : d.createdAt,
  }))

  const canUploadCoachCategories =
    canEdit || userRole === "ATHLETIC_DIRECTOR" || userRole === "SCHOOL_ADMIN"
  const allowPlayerParentMediaUpload = userRole === "PLAYER" || userRole === "PARENT"

  return (
    <DocumentsManager
      teamId={teamId}
      documents={docsWithDate}
      canUploadCoachCategories={canUploadCoachCategories}
      allowPlayerParentMediaUpload={allowPlayerParentMediaUpload}
      userRole={userRole}
      listLoading={listLoading}
    />
  )
}
