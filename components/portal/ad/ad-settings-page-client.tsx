"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type School = {
  name: string
  city: string | null
  state: string | null
  school_type: string | null
  mascot: string | null
  website: string | null
} | null

export function AdSettingsPageClient() {
  const router = useRouter()
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading")
  const [school, setSchool] = useState<School>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/ad/pages/settings", { credentials: "include", cache: "no-store" })
        if (res.status === 401) {
          router.replace("/login?callbackUrl=/dashboard/ad/settings")
          return
        }
        if (res.status === 403) {
          router.replace("/dashboard")
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { redirectTo?: string; school: School }
        if (cancelled) return
        if (json.redirectTo) {
          router.replace(json.redirectTo)
          return
        }
        setSchool(json.school)
        setPhase("ready")
      } catch {
        if (!cancelled) setPhase("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (phase === "error") {
    return <p className="text-[#212529]">Could not load settings.</p>
  }
  if (phase === "loading") {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-72 rounded bg-[#E5E7EB]" />
        <div className="h-64 rounded-xl bg-[#F3F4F6]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#212529]">Department settings</h1>
        <p className="mt-1 text-[#6B7280]">Manage your school and athletic department information.</p>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-[#212529]">School information</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">School name</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">Type</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.school_type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">City</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.city ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">State</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.state ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">Mascot</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.mascot ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">Website</dt>
            <dd className="mt-1 text-sm text-[#212529]">
              {school?.website ? (
                <a href={school.website} target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline">
                  {school.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-[#6B7280]">Editable school and billing settings will be available in a future update.</p>
      </div>
    </div>
  )
}
