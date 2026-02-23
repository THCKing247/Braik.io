"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { AlertCircle, Calendar, Megaphone, Package } from "lucide-react"
import Link from "next/link"

interface Update {
  id: string
  type: string
  title: string
  description?: string
  linkUrl?: string
  linkType?: string
  linkId?: string
  urgency: string
  createdAt: string
}

interface UpdatesFeedProps {
  updates: Update[]
}

export function UpdatesFeed({ updates }: UpdatesFeedProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "announcement":
        return <Megaphone className="h-4 w-4" />
      case "event_created":
      case "event_updated":
      case "event_canceled":
        return <Calendar className="h-4 w-4" />
      case "inventory_update":
        return <Package className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getLinkHref = (update: Update) => {
    if (!update.linkType || !update.linkId) return "#"
    switch (update.linkType) {
      case "announcement":
        return `/dashboard/announcements#${update.linkId}`
      case "event":
        return `/dashboard/schedule#${update.linkId}`
      case "inventory":
        return `/dashboard/inventory#${update.linkId}`
      default:
        return "#"
    }
  }

  if (updates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl" style={{ color: "rgb(var(--text))" }}>Recent Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8" style={{ color: "rgb(var(--muted))" }}>No updates yet</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl" style={{ color: "rgb(var(--text))" }}>Recent Updates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {updates.map((update) => {
            const href = getLinkHref(update)
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
                  <div className="mt-0.5" style={{ color: "rgb(var(--accent))" }}>{getIcon(update.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1" style={{ color: "rgb(var(--text))" }}>{update.title}</div>
                    {update.description && (
                      <div className="text-xs mt-1" style={{ color: "rgb(var(--text2))" }}>{update.description}</div>
                    )}
                    <div className="text-xs mt-2 font-medium" style={{ color: "rgb(var(--muted))" }}>
                      {format(new Date(update.createdAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                </div>
              </div>
            )

            if (href !== "#") {
              return (
                <Link key={update.id} href={href}>
                  {content}
                </Link>
              )
            }

            return <div key={update.id}>{content}</div>
          })}
        </div>
      </CardContent>
    </Card>
  )
}
