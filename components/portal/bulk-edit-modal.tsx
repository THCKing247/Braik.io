"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

interface BulkEditModalProps {
  open: boolean
  onClose: () => void
  equipmentType: string
  itemCount: number
  onSave: (data: {
    condition?: string
    status?: string
    notes?: string
  }) => Promise<void>
  loading?: boolean
}

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_REPAIR", "REPLACE"] as const
const AVAILABILITY_STATUSES = ["AVAILABLE", "ASSIGNED", "MISSING", "NEEDS_REPLACEMENT", "DAMAGED"] as const

export function BulkEditModal({
  open,
  onClose,
  equipmentType,
  itemCount,
  onSave,
  loading = false,
}: BulkEditModalProps) {
  const [condition, setCondition] = useState<typeof CONDITIONS[number] | "">("")
  const [status, setStatus] = useState<typeof AVAILABILITY_STATUSES[number] | "">("")
  const [notes, setNotes] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await onSave({
        condition: condition || undefined,
        status: status || undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (error) {
      // Error handling is done in parent component
    }
  }

  const handleClose = () => {
    if (!loading) {
      setCondition("")
      setStatus("")
      setNotes("")
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Edit All {equipmentType} Items
          </DialogTitle>
          <DialogDescription>
            Changes will apply to all {itemCount} items of this type. Leave fields empty to keep current values.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Condition */}
          <div className="space-y-2">
            <Label htmlFor="condition" style={{ color: "rgb(var(--text))" }}>
              Condition (Optional)
            </Label>
            <select
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as typeof CONDITIONS[number] | "")}
              className="w-full px-3 py-2 border rounded-md"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            >
              <option value="">Keep Current</option>
              {CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" style={{ color: "rgb(var(--text))" }}>
              Availability Status (Optional)
            </Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof AVAILABILITY_STATUSES[number] | "")}
              className="w-full px-3 py-2 border rounded-md"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            >
              <option value="">Keep Current</option>
              {AVAILABILITY_STATUSES.map((stat) => (
                <option key={stat} value={stat}>
                  {stat.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" style={{ color: "rgb(var(--text))" }}>
              Notes (Optional)
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-md min-h-[80px] resize-none"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
              placeholder="Additional notes for all items..."
            />
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              Leave empty to keep current notes, or enter new notes to replace all existing notes
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: "rgb(var(--border))" }}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              style={{
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
            >
              {loading ? "Updating..." : `Update All ${itemCount} Items`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
