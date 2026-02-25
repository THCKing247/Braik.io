"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trackMarketingEvent } from "@/lib/analytics-client"

export function LeadCaptureForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [school, setSchool] = useState("")
  const [role, setRole] = useState("Head Coach")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = useState("")

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus("loading")
    setError("")

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          school,
          role,
          message,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || "Unable to submit demo request")
      }

      setStatus("success")
      setName("")
      setEmail("")
      setPhone("")
      setSchool("")
      setRole("Head Coach")
      setMessage("")
      trackMarketingEvent("submitted_lead", { role })
    } catch (submitError: any) {
      setStatus("error")
      setError(submitError?.message || "Unable to submit demo request")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lead-name" className="text-white">Name *</Label>
          <Input
            id="lead-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            className="bg-white text-[#212529]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-email" className="text-white">Email *</Label>
          <Input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            required
            className="bg-white text-[#212529]"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lead-phone" className="text-white">Phone</Label>
          <Input
            id="lead-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            className="bg-white text-[#212529]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-school" className="text-white">School / Program</Label>
          <Input
            id="lead-school"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="Example High School"
            className="bg-white text-[#212529]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-role" className="text-white">Primary Role</Label>
        <select
          id="lead-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        >
          <option>Head Coach</option>
          <option>Assistant Coach</option>
          <option>Athletic Director</option>
          <option>Parent / Booster</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-message" className="text-white">Message</Label>
        <textarea
          id="lead-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what your program needs most."
          className="min-h-[120px] w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        />
      </div>

      {status === "success" && (
        <p className="text-sm text-green-300">Thanks - your request is in. We will reach out soon.</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-300" role="alert">{error}</p>
      )}

      <Button type="submit" disabled={status === "loading"} className="w-full md:w-auto">
        {status === "loading" ? "Sending..." : "Request demo"}
      </Button>
    </form>
  )
}
