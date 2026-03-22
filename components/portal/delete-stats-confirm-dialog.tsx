"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export interface DeleteStatsConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  loading?: boolean
  errorMessage?: string | null
}

export function DeleteStatsConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  errorMessage = null,
}: DeleteStatsConfirmDialogProps) {
  const [ack, setAck] = useState(false)

  useEffect(() => {
    if (!open) setAck(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Stats?</DialogTitle>
          <DialogDescription>
            You are about to permanently delete the selected stat records. This action cannot be undone.
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
            I understand these stats will be permanently deleted.
          </Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!ack || loading}
            onClick={() => void onConfirm()}
          >
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
