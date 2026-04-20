const BILLING_EMAIL = "billing@apextsgroup.com"

interface SuspensionBannerProps {
  teamStatus?: string | null
  className?: string
}

/**
 * Portal notice when `teams.team_status` is `suspended` (resolved via dashboard shell / team list).
 */
export function SuspensionBanner({ teamStatus, className }: SuspensionBannerProps) {
  const normalizedStatus = (teamStatus || "").trim().toLowerCase()
  if (normalizedStatus !== "suspended") {
    return null
  }

  const rootClass =
    className ??
    "mb-4 shrink-0 rounded-lg border border-orange-600/90 bg-orange-500 px-3 py-3 text-sm leading-relaxed text-white shadow-sm sm:px-4"

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <p className="text-white">
        This account is currently suspended. Certain actions are not accessible at this time. Please contact{" "}
        <a
          href={`mailto:${BILLING_EMAIL}`}
          className="font-semibold text-white underline decoration-white/85 underline-offset-2 hover:decoration-white"
        >
          {BILLING_EMAIL}
        </a>{" "}
        for assistance.
      </p>
    </div>
  )
}
