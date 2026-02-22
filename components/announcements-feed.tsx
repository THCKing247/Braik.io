"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { Megaphone } from "lucide-react"
import Link from "next/link"

interface Announcement {
  id: string
  title: string
  body: string
  audience: string
  createdAt: string
  creator: {
    name: string | null
    email: string
  }
}

interface AnnouncementsFeedProps {
  announcements: Announcement[]
}

export function AnnouncementsFeed({ announcements }: AnnouncementsFeedProps) {
  if (announcements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl" style={{ color: "rgb(var(--text))" }}>Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8" style={{ color: "rgb(var(--muted))" }}>No announcements yet</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl" style={{ color: "rgb(var(--text))" }}>Announcements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {announcements.map((announcement) => {
            const content = (
              <div
                className="p-4 rounded-lg border cursor-pointer hover:shadow-sm transition-all duration-200"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--alabaster))",
                  borderWidth: "1px"
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5" style={{ color: "rgb(var(--accent))" }}>
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1" style={{ color: "rgb(var(--text))" }}>
                      {announcement.title}
                    </div>
                    <div className="text-xs mt-1 line-clamp-2" style={{ color: "rgb(var(--text2))" }}>
                      {announcement.body}
                    </div>
                    <div className="text-xs mt-2 font-medium" style={{ color: "rgb(var(--muted))" }}>
                      {format(new Date(announcement.createdAt), "MMM d, h:mm a")}
                      {announcement.creator.name && (
                        <span> • {announcement.creator.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )

            return (
              <Link key={announcement.id} href={`/dashboard/announcements#${announcement.id}`}>
                {content}
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
