"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/player-documents/constants"
import { REQUIRED_DOC_CATEGORIES } from "@/lib/readiness"
import { Loader2 } from "lucide-react"

function defaultRequiredMap(): Record<DocumentType, boolean> {
  const o = {} as Record<DocumentType, boolean>
  for (const t of DOCUMENT_TYPES) {
    o[t] = (REQUIRED_DOC_CATEGORIES as readonly string[]).includes(t)
  }
  return o
}

export function DocumentSettingsSection({ teamId }: { teamId: string }) {
  const [required, setRequired] = useState<Record<DocumentType, boolean>>(defaultRequiredMap)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/roster-template`, { cache: "no-store" })
      if (!res.ok) {
        setRequired(defaultRequiredMap())
        return
      }
      const data = (await res.json()) as {
        template?: { documentReadinessRequired?: Partial<Record<string, boolean>> }
      }
      const dr = data.template?.documentReadinessRequired
      if (dr && typeof dr === "object") {
        const next = defaultRequiredMap()
        for (const t of DOCUMENT_TYPES) {
          if (typeof dr[t] === "boolean") next[t] = dr[t] as boolean
        }
        setRequired(next)
      } else {
        setRequired(defaultRequiredMap())
      }
    } catch {
      setRequired(defaultRequiredMap())
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      const getRes = await fetch(`/api/teams/${teamId}/roster-template`)
      if (!getRes.ok) {
        alert("Could not load current settings.")
        return
      }
      const data = (await getRes.json()) as { template?: Record<string, unknown> }
      const template = {
        ...(data.template ?? {}),
        documentReadinessRequired: { ...required },
      }
      const patchRes = await fetch(`/api/teams/${teamId}/roster-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      })
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}))
        alert((err as { error?: string }).error || "Failed to save document requirements")
        return
      }
      await load()
      alert("Document requirements saved.")
    } catch {
      alert("Failed to save document requirements")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading document settings…
      </div>
    )
  }

  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">Document requirements</CardTitle>
        <CardDescription className="text-muted-foreground">
          Choose which player document types count as required for readiness on your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {DOCUMENT_TYPES.map((t) => (
            <div key={t} className="flex items-center gap-3">
              <Checkbox
                id={`doc-req-${t}`}
                className="accent-primary"
                checked={required[t]}
                onCheckedChange={(c) =>
                  setRequired((prev) => ({ ...prev, [t]: c === true }))
                }
              />
              <Label htmlFor={`doc-req-${t}`} className="cursor-pointer text-sm text-foreground">
                {DOCUMENT_TYPE_LABELS[t]} — required for readiness
              </Label>
            </div>
          ))}
        </div>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save document requirements"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
