"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * Play edit under sub-formation context: redirect to the central play editor with returnUrl
 * so the user returns to this sub-formation when done.
 */
export default function SubFormationPlayEditPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null
  const subFormationId = typeof params?.subFormationId === "string" ? params.subFormationId : null
  const playId = typeof params?.playId === "string" ? params.playId : null

  useEffect(() => {
    if (!playId || !playbookId || !formationId || !subFormationId) return
    const returnUrl = `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}`
    router.replace(`/dashboard/playbooks/play/${playId}?returnUrl=${encodeURIComponent(returnUrl)}`)
  }, [playId, playbookId, formationId, subFormationId, router])

  return (
    <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
      <p className="text-sm text-slate-500">Loading editor...</p>
    </div>
  )
}
