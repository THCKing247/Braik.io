"use client"

import { useState } from "react"

export function ImpersonationBanner() {
  const [ending, setEnding] = useState(false)

  async function endSession() {
    setEnding(true)
    try {
      await fetch("/api/admin/impersonation/end", {
        method: "POST",
        credentials: "include",
      })
      window.location.href = "/admin/users"
    } catch {
      setEnding(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900">
      <span>Support Session Active – you are viewing as another user. Bank/payout changes are disabled.</span>
      {" "}
      <button
        type="button"
        onClick={endSession}
        disabled={ending}
        className="font-medium underline hover:no-underline disabled:opacity-50"
      >
        {ending ? "Ending…" : "End session & return to Admin"}
      </button>
    </div>
  )
}
