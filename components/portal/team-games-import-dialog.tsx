"use client"

import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { usePlaybookToast } from "@/components/portal/playbook-toast"

export function TeamGamesImportDialog({
  teamId,
  open,
  onOpenChange,
  onImported,
}: {
  teamId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onImported: () => void
}) {
  const { showToast } = usePlaybookToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [lastErrors, setLastErrors] = useState<Array<{ row: number; message: string }>>([])

  const runImport = async (file: File) => {
    setBusy(true)
    setLastErrors([])
    try {
      const fd = new FormData()
      fd.set("file", file)
      const res = await fetch(`/api/teams/${teamId}/games/import`, {
        method: "POST",
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        inserted?: number
        parseErrors?: Array<{ row: number; message: string }>
        rowErrors?: Array<{ row: number; message: string }>
        error?: string
      }

      if (!res.ok) {
        const parseErrs = [...(data.parseErrors ?? []), ...(data.rowErrors ?? [])]
        setLastErrors(parseErrs)
        showToast(data.error || "Import failed. Fix the CSV and try again.", "error")
        return
      }

      const parseErrs = data.parseErrors ?? []
      const rowErrs = data.rowErrors ?? []
      const allErrs = [...parseErrs, ...rowErrs]
      setLastErrors(allErrs)

      if (data.success && (data.inserted ?? 0) > 0) {
        showToast(
          allErrs.length
            ? `Imported ${data.inserted} game(s). Some CSV rows had warnings — see below.`
            : `Imported ${data.inserted} game(s).`,
          "success"
        )
        onImported()
        if (!allErrs.length) onOpenChange(false)
      } else {
        showToast("No games were imported.", "error")
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Import failed", "error")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload schedule (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Include a header row with at least: <code className="rounded bg-muted px-1">opponent</code>,{" "}
            <code className="rounded bg-muted px-1">game_date</code>. Optional columns:{" "}
            <code className="rounded bg-muted px-1">location</code>, <code className="rounded bg-muted px-1">game_type</code>{" "}
            (regular, playoff, scrimmage, tournament), <code className="rounded bg-muted px-1">conference_game</code> (true/false),{" "}
            <code className="rounded bg-muted px-1">notes</code>.
          </p>
          <p>
            <code className="rounded bg-muted px-1">game_date</code> can be ISO 8601 (e.g.{" "}
            <code className="rounded bg-muted px-1">2025-09-12T19:00:00Z</code>) or any string JavaScript can parse.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void runImport(f)
          }}
        />

        {lastErrors.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <p className="font-semibold text-destructive">Issues</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {lastErrors.slice(0, 40).map((e, i) => (
                <li key={`${e.row}-${i}`}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
            {lastErrors.length > 40 && <p className="mt-1 text-muted-foreground">…and more</p>}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
