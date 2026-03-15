"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const JOIN_TOKEN_KEY = "braik_join_token"

export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tokenFromUrl = searchParams.get("token")?.trim() || null
  const [status, setStatus] = useState<"loading" | "redirect_to_auth" | "redeeming" | "success" | "error" | "invalid">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState("")
  const [redeemCodeLoading, setRedeemCodeLoading] = useState(false)

  const redeem = useCallback(
    async (tokenOrCode: string, isCode: boolean) => {
      setStatus("redeeming")
      setErrorMessage(null)
      try {
        const res = await fetch("/api/player-invites/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isCode ? { code: tokenOrCode } : { token: tokenOrCode }),
          credentials: "same-origin",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = (data as { error?: string }).error ?? "Failed to link your roster spot."
          setErrorMessage(msg)
          setStatus("error")
          return
        }
        const payload = data as { player_id?: string; team_id?: string }
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(JOIN_TOKEN_KEY)
        }
        setStatus("success")
        router.replace("/dashboard/profile")
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.")
        setStatus("error")
      }
    },
    [router]
  )

  const redeemToken = useCallback(
    (token: string) => redeem(token, false),
    [redeem]
  )

  const redeemManualCode = async () => {
    const code = manualCode.trim().toUpperCase()
    if (!code) return
    setRedeemCodeLoading(true)
    try {
      await redeem(code, true)
    } finally {
      setRedeemCodeLoading(false)
    }
  }

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
            This link is missing a token or has expired. Ask your coach to send a new invite link, or enter your invite code below.
          </p>
          <div className="mt-6 space-y-3">
            <div className="text-left">
              <Label htmlFor="join-code" className="text-sm text-[#374151]">Invite code</Label>
              <Input
                id="join-code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC12XYZ"
                className="mt-1 font-mono"
                maxLength={20}
              />
            </div>
            <Button onClick={redeemManualCode} disabled={!manualCode.trim() || redeemCodeLoading} className="w-full">
              {redeemCodeLoading ? "Linking…" : "Redeem code"}
            </Button>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">Go to sign in</Button>
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
          <div className="mt-6 space-y-3">
            <div className="text-left">
              <Label htmlFor="join-code-error" className="text-sm text-[#374151]">Or enter your invite code</Label>
              <Input
                id="join-code-error"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC12XYZ"
                className="mt-1 font-mono"
                maxLength={20}
              />
            </div>
            <Button onClick={redeemManualCode} disabled={!manualCode.trim() || redeemCodeLoading} className="w-full">
              {redeemCodeLoading ? "Linking…" : "Redeem code"}
            </Button>
            <div className="flex gap-3 justify-center">
              <Link href="/dashboard/profile">
                <Button variant="outline">Go to profile</Button>
              </Link>
              <Link href="/login">
                <Button>Sign in</Button>
              </Link>
            </div>
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
