"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { OnboardingWizard } from "@/components/portal/onboarding-wizard"

export function OnboardingPageClient() {
  const router = useRouter()
  const { status, data } = useSession()
  const [allow, setAllow] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/onboarding")
    }
    if (status === "authenticated" && data?.user?.id) {
      setAllow(true)
    }
  }, [status, data, router])

  if (status === "loading" || !allow) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded-lg bg-muted/60" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">Set Up Your Team</h1>
      <OnboardingWizard />
    </div>
  )
}
