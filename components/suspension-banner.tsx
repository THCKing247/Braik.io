interface SuspensionBannerProps {
  teamStatus?: string | null
  role?: string | null
}

export function SuspensionBanner({ teamStatus, role }: SuspensionBannerProps) {
  const normalizedStatus = (teamStatus || "").toLowerCase()
  if (normalizedStatus === "active" || !normalizedStatus) {
    return null
  }

  const normalizedRole = (role || "").toUpperCase()
  if (normalizedRole === "HEAD_COACH") {
    return (
      <div className="mb-4 rounded-lg border border-red-400 bg-red-500/15 px-4 py-3 text-sm text-red-100">
        <p className="font-semibold">⚠️ Account Suspended - Action Required</p>
        <a href="/dashboard/invoice" className="mt-1 inline-block text-xs text-red-200 underline">
          Resolve Payment
        </a>
      </div>
    )
  }

  if (normalizedRole === "ASSISTANT_COACH") {
    return (
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
        <p className="font-semibold">⏳ Account Pending Action - Waiting on Head Coach</p>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-500/15 px-4 py-3 text-sm text-yellow-100">
      <p className="font-semibold">⏳ Program Pending Action - Access Limited</p>
    </div>
  )
}
