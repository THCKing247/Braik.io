"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileDropZone } from "@/components/ui/file-drop-zone"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { FileText, X } from "lucide-react"

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
  const [busy, setBusy] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [lastErrors, setLastErrors] = useState<Array<{ row: number; message: string }>>([])

  useEffect(() => {
    if (!open) return
    setSelectedFile(null)
    setTypeError(null)
    setLastErrors([])
  }, [open])

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
        setSelectedFile(null)
        setTypeError(null)
        if (!allErrs.length) onOpenChange(false)
      } else {
        showToast("No games were imported.", "error")
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Import failed", "error")
    } finally {
      setBusy(false)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setTypeError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,900px)] w-full overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload schedule (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3 text-sm" style={{ color: "rgb(var(--text2))" }}>
            <p className="font-medium" style={{ color: "rgb(var(--text))" }}>
              Upload a CSV with at least:
            </p>
            <ul className="list-inside list-disc space-y-1 pl-0.5">
              <li>
                <code className="rounded bg-[rgb(var(--platinum))] px-1.5 py-0.5 text-xs">opponent</code>
              </li>
              <li>
                <code className="rounded bg-[rgb(var(--platinum))] px-1.5 py-0.5 text-xs">game_date</code>
              </li>
            </ul>
            <p className="pt-1 font-medium" style={{ color: "rgb(var(--text))" }}>
              Optional fields:
            </p>
            <ul className="list-inside list-disc space-y-1 pl-0.5">
              <li>
                <code className="rounded bg-[rgb(var(--platinum))] px-1.5 py-0.5 text-xs">location</code>
              </li>
              <li>
                <code className="rounded bg-[rgb(var(--platinum))] px-1.5 py-0.5 text-xs">game_type</code>{" "}
                (regular, playoff, scrimmage, tournament)
              </li>
              <li>
                <code className="rounded bg-[rgb(var(--platinum))] px-1.5 py-0.5 text-xs">conference_game</code>{" "}
                (true/false)
              </li>
              <li>
                <code className="rounded bg-[rgb(var(--platinum))] px-1.5 py-0.5 text-xs">notes</code>
              </li>
            </ul>
          </div>

          <FileDropZone
            disabled={busy}
            error={typeError}
            onInvalidFile={(msg) => setTypeError(msg)}
            onFileChange={(f) => {
              setSelectedFile(f)
              if (f) setTypeError(null)
            }}
          />

          {selectedFile && (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--snow))" }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} aria-hidden />
                <span className="truncate text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                  {selectedFile.name}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1 text-xs"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation()
                  clearFile()
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Remove
              </Button>
            </div>
          )}
        </div>

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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button
            type="button"
            disabled={busy || !selectedFile}
            style={{ backgroundColor: "rgb(var(--accent))", color: "#fff" }}
            onClick={() => selectedFile && void runImport(selectedFile)}
          >
            {busy ? "Importing…" : "Import schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
