"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Link2,
  ArrowRight,
  CheckCircle2,
  Users,
  AlertCircle,
  Info,
} from "lucide-react"

interface ConnectToTeamProps {
  role: string
  onConnected?: () => void
}

function getRoleContent(role: string) {
  switch (role.toUpperCase()) {
    case "PARENT":
      return {
        headline: "Connect to Your Child's Team",
        subtitle:
          "Enter the Team Code provided by your child's Head Coach to link your account and see their team activity.",
        codeLabel: "Team Code",
        codePlaceholder: "Enter Team Code (e.g. ABC12345)",
        codeHint:
          "Your Team Code comes from the Head Coach. Ask them to share it with you directly or through your player.",
        noteTitle: "Player Linking — Coming Soon",
        noteBody:
          "In an upcoming update, each player will have a unique Player Code that lets you link directly to their profile. For now, entering the Team Code connects you to the program.",
      }
    case "ASSISTANT_COACH":
      return {
        headline: "Connect to Your Team",
        subtitle:
          "Enter the Team Code from your Head Coach to access the full team dashboard and all coaching tools.",
        codeLabel: "Team Code",
        codePlaceholder: "Enter Team Code (e.g. ABC12345)",
        codeHint: "Get your Team Code from your Head Coach.",
        noteTitle: null,
        noteBody: null,
      }
    default: // PLAYER
      return {
        headline: "Connect to Your Team",
        subtitle:
          "Enter the Team Code from your coach to unlock your full team dashboard — roster, schedule, messages, and more.",
        codeLabel: "Team Code",
        codePlaceholder: "Enter Team Code (e.g. ABC12345)",
        codeHint: "Get your Team Code from your Head Coach.",
        noteTitle: null,
        noteBody: null,
      }
  }
}

export function ConnectToTeam({ role, onConnected }: ConnectToTeamProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const content = getRoleContent(role)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!code.trim()) {
      setError("Please enter your code.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/team/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
        credentials: "include",
      })
      const data = (await res.json()) as { success?: boolean; error?: string; teamName?: string }

      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong. Please try again.")
        setLoading(false)
        return
      }

      setSuccess(data.teamName ?? "your team")
      setLoading(false)

      // Reload the page after a short delay so the dashboard refreshes with team data
      setTimeout(() => {
        if (onConnected) {
          onConnected()
        } else {
          window.location.reload()
        }
      }, 1800)
    } catch {
      setError("A network error occurred. Please check your connection and try again.")
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card
          className="w-full max-w-md border text-center"
          style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
        >
          <CardContent className="flex flex-col items-center gap-5 py-12 px-8">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "rgba(34,197,94,0.1)" }}
            >
              <CheckCircle2 className="h-9 w-9" style={{ color: "rgb(var(--success))" }} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>
                You're connected!
              </h2>
              <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                Successfully joined <strong>{success}</strong>. Loading your dashboard…
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-5">

        {/* Hero card */}
        <Card
          className="border"
          style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgb(var(--platinum))" }}
              >
                <Link2 className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
              </div>
              <CardTitle className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>
                {content.headline}
              </CardTitle>
            </div>
            <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
              {content.subtitle}
            </p>
          </CardHeader>

          <CardContent className="space-y-5 pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="team-code"
                  className="text-sm font-semibold"
                  style={{ color: "rgb(var(--text))" }}
                >
                  {content.codeLabel}
                </Label>
                <Input
                  id="team-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={content.codePlaceholder}
                  maxLength={8}
                  className="font-mono text-lg tracking-widest"
                  style={{
                    color: "rgb(var(--text))",
                    borderColor: error ? "rgb(var(--danger))" : "rgb(var(--border))",
                  }}
                  autoFocus
                />
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  {content.codeHint}
                </p>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.06)",
                    borderColor: "rgba(239,68,68,0.25)",
                    color: "rgb(var(--danger))",
                  }}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full flex items-center justify-center gap-2 font-semibold text-white"
                style={{ backgroundColor: "rgb(var(--accent))" }}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Verifying code…
                  </>
                ) : (
                  <>
                    Connect to Team
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* "Skip for now" — subtle link */}
            <p className="text-center text-xs" style={{ color: "rgb(var(--muted))" }}>
              Don&apos;t have your code yet?{" "}
              <span style={{ color: "rgb(var(--text))" }}>
                You can still browse the dashboard and add it later.
              </span>
            </p>
          </CardContent>
        </Card>

        {/* What's locked / what's accessible */}
        <Card
          className="border"
          style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "rgb(var(--border))" }}
        >
          <CardContent className="py-4 px-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--text2))" }}>
              What you can do right now
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: "Set up your profile", available: true },
                { label: "Browse the dashboard", available: true },
                { label: "View team roster", available: false },
                { label: "See schedule & events", available: false },
                { label: "Access messages", available: false },
                { label: "View documents", available: false },
              ].map(({ label, available }) => (
                <div key={label} className="flex items-center gap-2">
                  {available ? (
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "rgb(var(--success))" }} />
                  ) : (
                    <div
                      className="h-3.5 w-3.5 flex-shrink-0 rounded-full border-2"
                      style={{ borderColor: "rgb(var(--focus))" }}
                    />
                  )}
                  <span style={{ color: available ? "rgb(var(--text))" : "rgb(var(--muted))" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Parent-specific note about player codes */}
        {content.noteTitle && (
          <Card
            className="border"
            style={{ backgroundColor: "rgba(37,99,235,0.04)", borderColor: "rgba(37,99,235,0.2)" }}
          >
            <CardContent className="py-4 px-5 flex gap-3">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "rgb(var(--accent))" }} />
              <div className="space-y-1">
                <p className="text-xs font-semibold" style={{ color: "rgb(var(--accent))" }}>
                  {content.noteTitle}
                </p>
                <p className="text-xs" style={{ color: "rgb(var(--text2))" }}>
                  {content.noteBody}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How it works */}
        <Card
          className="border"
          style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
        >
          <CardContent className="py-4 px-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--text2))" }}>
              How it works
            </p>
            <div className="space-y-2">
              {[
                { icon: Users, text: "Head Coach creates a team and receives a unique Team Code" },
                { icon: Link2, text: "Coach shares the Team Code with players, assistants, and parents" },
                { icon: CheckCircle2, text: "Members enter the code here to unlock their full team dashboard" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: "rgb(var(--platinum))", color: "rgb(var(--accent))" }}
                  >
                    {i + 1}
                  </div>
                  <span style={{ color: "rgb(var(--muted))" }}>{text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
