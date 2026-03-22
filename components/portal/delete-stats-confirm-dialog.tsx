"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export type StatsDeleteConfirmMode = "soft_delete_weekly" | "resync_season"

export interface DeleteStatsConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  loading?: boolean
  errorMessage?: string | null
  /** All Stats: recalc season totals from weekly rows. Weekly: soft-delete entries. */
  confirmMode?: StatsDeleteConfirmMode
}

export function DeleteStatsConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  errorMessage = null,
  confirmMode = "soft_delete_weekly",
}: DeleteStatsConfirmDialogProps) {
  const [ack, setAck] = useState(false)
  const resync = confirmMode === "resync_season"

  useEffect(() => {
    if (!open) setAck(false)
  }, [open, confirmMode])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{resync ? "Re-sync season totals?" : "Delete Stats?"}</DialogTitle>
          <DialogDescription>
            {resync
              ? "Season totals on All Stats will be recalculated from weekly/game rows for the selected players. Custom stat keys (outside the standard set) are preserved. No weekly rows are removed."
              : "You are about to permanently delete the selected weekly stat records (soft delete). This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        {errorMessage && (
          <p className="text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="flex items-start gap-2 rounded-md border p-3" style={{ borderColor: "rgb(var(--border))" }}>
          <Checkbox
            id="delete-stats-ack"
            checked={ack}
            onCheckedChange={(c) => setAck(Boolean(c))}
            className="mt-0.5"
          />
          <Label htmlFor="delete-stats-ack" className="text-sm font-normal cursor-pointer leading-snug" style={{ color: "rgb(var(--text))" }}>
            {resync
              ? "I understand season totals will be replaced with sums from weekly rows for these players."
              : "I understand these stats will be permanently deleted."}
          </Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={resync ? "default" : "destructive"}
            disabled={!ack || loading}
            onClick={() => void onConfirm()}
          >
            {loading ? (resync ? "Syncing…" : "Deleting…") : resync ? "Re-sync" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
