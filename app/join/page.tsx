"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const JOIN_TOKEN_KEY = "braik_join_token"

export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tokenFromUrl = searchParams.get("token")?.trim() || null
  const [status, setStatus] = useState<"loading" | "redirect_to_auth" | "redeeming" | "success" | "error" | "invalid">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const redeemToken = useCallback(
    async (token: string) => {
      setStatus("redeeming")
      setErrorMessage(null)
      try {
        const res = await fetch("/api/player-invites/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "same-origin",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setErrorMessage((data as { error?: string }).error ?? "Failed to link your roster spot.")
          setStatus("error")
          return
        }
        const payload = data as { player_id?: string; team_id?: string }
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(JOIN_TOKEN_KEY)
          if ((window as unknown as { toast?: { success?: (m: string) => void } }).toast?.success) {
            ;(window as unknown as { toast: { success: (m: string) => void } }).toast.success("Your roster spot has been linked.")
          }
        }
        setStatus("success")
        const teamId = payload.team_id
        const playerId = payload.player_id
        const dest = teamId && playerId
          ? `/dashboard/roster/${playerId}?teamId=${encodeURIComponent(teamId)}`
          : "/dashboard/profile"
        router.replace(dest)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.")
        setStatus("error")
      }
    },
    [router]
  )

  useEffect(() => {
    const token = tokenFromUrl || (typeof window !== "undefined" ? sessionStorage.getItem(JOIN_TOKEN_KEY) : null)
    if (!token) {
      setStatus("invalid")
      return
    }

    if (tokenFromUrl && typeof window !== "undefined") {
      sessionStorage.setItem(JOIN_TOKEN_KEY, token)
    }

    let cancelled = false
    setStatus("loading")

    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data: { user?: { id: string } }) => {
        if (cancelled) return
        if (data?.user?.id) {
          redeemToken(token)
        } else {
          if (typeof window !== "undefined") {
            sessionStorage.setItem(JOIN_TOKEN_KEY, token)
            const callbackUrl = `/join?token=${encodeURIComponent(token)}`
            window.location.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
          }
          setStatus("redirect_to_auth")
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error")
          setErrorMessage("Could not verify session. Try again.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [tokenFromUrl, redeemToken])

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] px-4">
        <div className="rounded-xl border border-[rgb(var(--border))] bg-white p-8 shadow-sm max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-[#0F172A]">Invalid invite link</h1>
          <p className="mt-2 text-sm text-[#64748B]">
            This link is missing a token or has expired. Ask your coach to send a new invite link.
          </p>
          <div className="mt-6">
            <Link href="/login">
              <Button variant="outline">Go to sign in</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] px-4">
        <div className="rounded-xl border border-[rgb(var(--border))] bg-white p-8 shadow-sm max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-[#0F172A]">Could not link roster spot</h1>
          <p className="mt-2 text-sm text-[#64748B]">{errorMessage}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link href="/dashboard/profile">
              <Button variant="outline">Go to profile</Button>
            </Link>
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] px-4">
      <div className="rounded-xl border border-[rgb(var(--border))] bg-white p-8 shadow-sm max-w-md w-full text-center">
        {(status === "loading" || status === "redirect_to_auth") && (
          <>
            <div className="h-10 w-10 mx-auto rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent animate-spin" />
            <p className="mt-4 text-sm text-[#64748B]">
              {status === "redirect_to_auth" ? "Taking you to sign in…" : "Linking your roster spot…"}
            </p>
          </>
        )}
        {status === "redeeming" && (
          <>
            <div className="h-10 w-10 mx-auto rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent animate-spin" />
            <p className="mt-4 text-sm text-[#64748B]">Linking your roster spot…</p>
          </>
        )}
        {status === "success" && (
          <p className="text-sm text-[#64748B]">Redirecting to your profile…</p>
        )}
      </div>
    </div>
  )
}
