"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { Megaphone } from "lucide-react"

interface Announcement {
  id: string
  title: string
  body: string
  audience: string
  createdAt: Date
  creator: { name: string | null; email: string }
}

export function AnnouncementsManager({ teamId, announcements: initialAnnouncements, canPost }: { teamId: string; announcements: Announcement[]; canPost: boolean }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState("all")

  const handleAddAnnouncement = async () => {
    if (!title || !body) {
      alert("Title and body are required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          title,
          body,
          audience,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to post announcement")
      }

      const newAnnouncement = await response.json()
      setAnnouncements([newAnnouncement, ...announcements])
      setTitle("")
      setBody("")
      setShowAddForm(false)
    } catch (error) {
      alert("Error posting announcement")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {canPost && (
        <div className="mb-6">
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)}>Post Announcement</Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Post Announcement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Message *</Label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="flex min-h-[120px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                    >
                      <option value="all">All</option>
                      <option value="players">Players</option>
                      <option value="parents">Parents</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <Button onClick={handleAddAnnouncement} disabled={loading}>
                    {loading ? "Posting..." : "Post Announcement"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {announcements.map((announcement) => (
          <Card key={announcement.id}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 mb-2">
                <div style={{ color: "rgb(var(--accent))" }}>
                  <Megaphone className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2" style={{ color: "rgb(var(--text))" }}>{announcement.title}</h3>
                  <p className="whitespace-pre-wrap mb-4" style={{ color: "rgb(var(--text))" }}>{announcement.body}</p>
                  <div className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                    {format(new Date(announcement.createdAt), "MMM d, yyyy 'at' h:mm a")} • Audience: {announcement.audience} • By {announcement.creator.name || announcement.creator.email}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

