"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WAITLIST_ROLE_OPTIONS } from "@/lib/waitlist/submission"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

export function WaitlistForm() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string>(WAITLIST_ROLE_OPTIONS[0].value)
  const [organizationName, setOrganizationName] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [duplicate, setDuplicate] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    setErrorMessage("")
    setFieldErrors({})
    setDuplicate(false)

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          role,
          organizationName,
          message: message.trim() ? message : undefined,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        fieldErrors?: Record<string, string>
        duplicate?: boolean
      }

      if (!res.ok && data.error === "validation" && data.fieldErrors) {
        setStatus("error")
        setFieldErrors(data.fieldErrors)
        return
      }

      if (!res.ok || data.ok === false) {
        setStatus("error")
        setErrorMessage("Something went wrong. Please try again in a moment.")
        return
      }

      setStatus("success")
      setDuplicate(Boolean(data.duplicate))
      trackMarketingEvent("submitted_waitlist", { role })
      if (!data.duplicate) {
        setFirstName("")
        setLastName("")
        setEmail("")
        setOrganizationName("")
        setMessage("")
        setRole(WAITLIST_ROLE_OPTIONS[0].value)
      }
    } catch {
      setStatus("error")
      setErrorMessage("Something went wrong. Please try again in a moment.")
    }
  }

  const err = (name: string) => fieldErrors[name]

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-5" noValidate>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="waitlist-first-name">First name</Label>
          <Input
            id="waitlist-first-name"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="bg-white text-[#212529]"
            aria-invalid={Boolean(err("firstName"))}
            aria-describedby={err("firstName") ? "waitlist-first-name-err" : undefined}
          />
          {err("firstName") ? (
            <p id="waitlist-first-name-err" className="text-sm text-red-600" role="alert">
              {err("firstName")}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-last-name">Last name</Label>
          <Input
            id="waitlist-last-name"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="bg-white text-[#212529]"
            aria-invalid={Boolean(err("lastName"))}
            aria-describedby={err("lastName") ? "waitlist-last-name-err" : undefined}
          />
          {err("lastName") ? (
            <p id="waitlist-last-name-err" className="text-sm text-red-600" role="alert">
              {err("lastName")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-email">Email</Label>
        <Input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white text-[#212529]"
          aria-invalid={Boolean(err("email"))}
          aria-describedby={err("email") ? "waitlist-email-err" : undefined}
        />
        {err("email") ? (
          <p id="waitlist-email-err" className="text-sm text-red-600" role="alert">
            {err("email")}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-role">Role</Label>
        <select
          id="waitlist-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
          aria-invalid={Boolean(err("role"))}
          aria-describedby={err("role") ? "waitlist-role-err" : undefined}
        >
          {WAITLIST_ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {err("role") ? (
          <p id="waitlist-role-err" className="text-sm text-red-600" role="alert">
            {err("role")}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-org">Organization / team name</Label>
        <Input
          id="waitlist-org"
          name="organizationName"
          autoComplete="organization"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          className="bg-white text-[#212529]"
          aria-invalid={Boolean(err("organizationName"))}
          aria-describedby={err("organizationName") ? "waitlist-org-err" : undefined}
        />
        {err("organizationName") ? (
          <p id="waitlist-org-err" className="text-sm text-red-600" role="alert">
            {err("organizationName")}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-message">Message (optional)</Label>
        <textarea
          id="waitlist-message"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything we should know about your program?"
          rows={4}
          className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
          aria-invalid={Boolean(err("message"))}
          aria-describedby={err("message") ? "waitlist-message-err" : undefined}
        />
        {err("message") ? (
          <p id="waitlist-message-err" className="text-sm text-red-600" role="alert">
            {err("message")}
          </p>
        ) : null}
      </div>

      {status === "success" ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          {duplicate ? (
            <p>You&apos;re already on the list with this email. We&apos;ll be in touch when it&apos;s your turn.</p>
          ) : (
            <p>
              You&apos;re on the list. Thanks — we&apos;ll email you when early access opens for your team.
            </p>
          )}
        </div>
      ) : null}

      {status === "error" && errorMessage ? (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={status === "loading"}
        className="w-full sm:w-auto font-athletic uppercase tracking-wide min-h-[44px]"
        size="lg"
      >
        {status === "loading" ? "Submitting…" : "Join the Waitlist"}
      </Button>
    </form>
  )
}
