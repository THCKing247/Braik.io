"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, FileText, Download } from "lucide-react"
import { format } from "date-fns"

interface EventDocument {
  id: string
  title: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
}

interface EventDetail {
  id: string
  eventType: string
  title: string
  start: string
  end: string
  location?: string | null
  description?: string | null
  creator: { name: string | null; email: string }
  linkedDocuments?: Array<{ document: EventDocument }>
}

interface EventDetailModalProps {
  event: EventDetail | null
  isOpen: boolean
  onClose: () => void
  teamId: string
}

export function EventDetailModal({ event, isOpen, onClose, teamId }: EventDetailModalProps) {
  const [documents, setDocuments] = useState<EventDocument[]>([])

  useEffect(() => {
    if (isOpen && event) {
      // Load documents if not already loaded
      if (event.linkedDocuments) {
        setDocuments(event.linkedDocuments.map((link) => link.document))
      } else {
        // Fetch documents for this event
        loadEventDocuments()
      }
    }
  }, [isOpen, event])

  const loadEventDocuments = async () => {
    if (!event) return
    try {
      const response = await fetch(`/api/events/${event.id}/documents`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error("Failed to load event documents:", error)
    }
  }

  if (!isOpen || !event) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl" style={{ color: "rgb(var(--text))" }}>
              {event.title}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event Type */}
            <div>
              <span 
                className="px-2 py-1 text-xs rounded border"
                style={{
                  backgroundColor: "rgb(var(--platinum))",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text2))"
                }}
              >
                {event.eventType}
              </span>
            </div>

            {/* Date and Time */}
            <div className="space-y-1">
              <div className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                {format(new Date(event.start), "EEEE, MMMM d, yyyy")}
              </div>
              <div className="text-sm" style={{ color: "rgb(var(--text2))" }}>
                {format(new Date(event.start), "h:mm a")} - {format(new Date(event.end), "h:mm a")}
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="text-sm" style={{ color: "rgb(var(--text2))" }}>
                📍 {event.location}
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="text-sm" style={{ color: "rgb(var(--text2))" }}>
                {event.description}
              </div>
            )}

            {/* Attached Documents */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
                  Attached Files
                </div>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded border"
                      style={{
                        borderColor: "rgb(var(--accent))",
                        borderWidth: "2px",
                        backgroundColor: "#FFFFFF",
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
                        <div className="flex-1">
                          <div className="font-medium text-sm" style={{ color: "rgb(var(--text))" }}>
                            {doc.title}
                          </div>
                          <div className="text-xs" style={{ color: "rgb(var(--text2))" }}>
                            {doc.fileName}
                            {doc.fileSize && ` • ${(doc.fileSize / 1024).toFixed(1)} KB`}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(doc.fileUrl, "_blank")}
                        className="gap-2"
                        style={{
                          borderColor: "rgb(var(--accent))",
                          color: "rgb(var(--accent))",
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Creator Info */}
            <div className="text-xs pt-2 border-t" style={{ color: "rgb(var(--muted))", borderColor: "rgb(var(--border))" }}>
              Created by {event.creator.name || event.creator.email}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
