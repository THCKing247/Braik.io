"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { AlertCircle, Calendar, Megaphone, Package } from "lucide-react"
import Link from "next/link"

interface Reminder {
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

interface RemindersFeedProps {
  reminders: Reminder[]
}

export function RemindersFeed({ reminders }: RemindersFeedProps) {
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

  const getLinkHref = (reminder: Reminder) => {
    if (!reminder.linkType || !reminder.linkId) return "#"
    switch (reminder.linkType) {
      case "announcement":
        return `/dashboard/announcements#${reminder.linkId}`
      case "event":
        return `/dashboard/schedule#${reminder.linkId}`
      case "inventory":
        return `/dashboard/inventory#${reminder.linkId}`
      default:
        return "#"
    }
  }

  if (reminders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl" style={{ color: "rgb(var(--text))" }}>Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8" style={{ color: "rgb(var(--muted))" }}>No reminders yet</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl" style={{ color: "rgb(var(--text))" }}>Reminders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reminders.map((reminder) => {
            const href = getLinkHref(reminder)
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
                  <div className="mt-0.5" style={{ color: "rgb(var(--accent))" }}>{getIcon(reminder.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1" style={{ color: "rgb(var(--text))" }}>{reminder.title}</div>
                    {reminder.description && (
                      <div className="text-xs mt-1" style={{ color: "rgb(var(--text2))" }}>{reminder.description}</div>
                    )}
                    <div className="text-xs mt-2 font-medium" style={{ color: "rgb(var(--muted))" }}>
                      {format(new Date(reminder.createdAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                </div>
              </div>
            )

            if (href !== "#") {
              return (
                <Link key={reminder.id} href={href}>
                  {content}
                </Link>
              )
            }

            return <div key={reminder.id}>{content}</div>
          })}
        </div>
      </CardContent>
    </Card>
  )
}
