"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppLoader } from "@/components/ui/app-loader"
import { useSession } from "@/lib/auth/client-auth"

const JOIN_TOKEN_KEY = "braik_join_token"

export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status, data } = useSession()
  const tokenFromUrl = searchParams.get("token")?.trim() || null
  const [statusLocal, setStatusLocal] = useState("loading")

  const redeem = useCallback(async (token: string) => {
    setStatusLocal("redeeming")
    const res = await fetch("/api/player-invites/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "same-origin",
    })
    if (res.ok) {
      router.replace("/dashboard/profile")
    } else {
      setStatusLocal("error")
    }
  }, [router])

  useEffect(() => {
    const token = tokenFromUrl || (typeof window !== "undefined" ? sessionStorage.getItem(JOIN_TOKEN_KEY) : null)
    if (!token) {
      setStatusLocal("invalid")
      return
    }

    if (tokenFromUrl && typeof window !== "undefined") {
      sessionStorage.setItem(JOIN_TOKEN_KEY, token)
    }

    if (status === "authenticated") {
      redeem(token)
    } else if (status === "unauthenticated") {
      router.replace(`/signup/player?token=${encodeURIComponent(token)}`)
    }
  }, [tokenFromUrl, status, redeem, router])

  if (statusLocal === "loading") {
    return <AppLoader size="lg" label="Loading…" />
  }

  return null
}
