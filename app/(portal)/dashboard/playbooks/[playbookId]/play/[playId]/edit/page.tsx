"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * Play edit under playbook context: redirect to the central play editor with returnUrl
 * so the user returns to this playbook when done.
 */
export default function PlaybookPlayEditPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const playId = typeof params?.playId === "string" ? params.playId : null

  useEffect(() => {
    if (!playId || !playbookId) return
    const returnUrl = `/dashboard/playbooks/${playbookId}`
    router.replace(`/dashboard/playbooks/play/${playId}?returnUrl=${encodeURIComponent(returnUrl)}`)
  }, [playId, playbookId, router])

  return (
    <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
      <p className="text-sm text-slate-500">Loading editor...</p>
    </div>
  )
}
