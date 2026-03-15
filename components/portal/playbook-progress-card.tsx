"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, CheckCircle } from "lucide-react"

interface PlayKnowledgeItem {
  id: string
  playId: string
  programId: string
  status: string
  quizScore: number | null
  lastViewedAt: string | null
  completedAt: string | null
  updatedAt: string
}

interface PlaybookProgressCardProps {
  programId: string
  /** Optional: show compact view for sidebar */
  compact?: boolean
}

export function PlaybookProgressCard({ programId, compact = false }: PlaybookProgressCardProps) {
  const [knowledge, setKnowledge] = useState<PlayKnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!programId) return
    setLoading(true)
    setError(null)
    fetch(`/api/players/me/play-knowledge?programId=${encodeURIComponent(programId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data: { knowledge?: PlayKnowledgeItem[] }) => setKnowledge(data.knowledge ?? []))
      .catch(() => setError("Could not load progress"))
      .finally(() => setLoading(false))
  }, [programId])

  const completed = knowledge.filter((k) => k.status === "quiz_passed" || k.status === "completed").length
  const viewed = knowledge.filter((k) => k.status === "viewed").length
  const notStarted = knowledge.filter((k) => k.status === "not_started").length
  const total = knowledge.length

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        </CardContent>
      </Card>
    )
  }

  if (error || total === 0) {
    if (compact) return null
    return (
      <Card className="border-border">
        <CardContent className="py-4 text-sm text-muted-foreground">
          No playbook assignments yet, or unable to load progress.
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <Card className="border-border">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Playbook</span>
            <span className="text-muted-foreground">
              {completed}/{total} completed
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Playbook progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Completed / quiz passed</span>
          <span className="font-medium">{completed}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Viewed</span>
          <span>{viewed}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Not started</span>
          <span>{notStarted}</span>
        </div>
        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            {total > 0 ? `${Math.round((completed / total) * 100)}% complete` : "No assignments"}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
