"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Mail, Send } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface RosterEmailModalProps {
  teamId: string
  onClose: () => void
}

export function RosterEmailModal({ teamId, onClose }: RosterEmailModalProps) {
  const [senderEmail, setSenderEmail] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const loadUserEmail = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (response.ok) {
          const data = await response.json()
          if (data.user?.email) {
            setSenderEmail(data.user.email)
            setSubject(`Roster - ${new Date().toLocaleDateString()}`)
          }
        }
      } catch (error) {
        console.error("Failed to load user email:", error)
      } finally {
        setLoading(false)
      }
    }
    loadUserEmail()
  }, [])

  const handleSend = async () => {
    if (!recipientEmail || !senderEmail) {
      alert("Please provide both sender and recipient email addresses")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      alert("Please enter a valid recipient email address")
      return
    }

    setSending(true)
    try {
      const response = await fetch("/api/roster/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          senderEmail,
          recipientEmail,
          subject: subject || `Roster - ${new Date().toLocaleDateString()}`,
          message: message || "",
        }),
      })

      if (response.ok) {
        alert("Roster email sent successfully!")
        onClose()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to send email")
      }
    } catch (error) {
      console.error("Failed to send email:", error)
      alert("Failed to send email")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-[#1e3a5f] rounded-lg p-8 text-white">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-white" />
              <CardTitle className="text-white">Email Roster</CardTitle>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senderEmail" className="text-white">From (Your Email)</Label>
            <Input
              id="senderEmail"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="bg-white/10 border-white/20 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientEmail" className="text-white">To (Recipient Email) *</Label>
            <Input
              id="recipientEmail"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="bg-white/10 border-white/20 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject" className="text-white">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Roster - [Date]"
              className="bg-white/10 border-white/20 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-white">Message (Optional)</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to the email..."
              className="w-full bg-white/10 border border-white/20 text-white rounded-md px-3 py-2 min-h-[100px]"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSend} disabled={sending || !recipientEmail} className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : "Send Email"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
