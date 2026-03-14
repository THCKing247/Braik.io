"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface LeaveWithoutSavingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}

export function LeaveWithoutSavingDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: LeaveWithoutSavingDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }
  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            You have unsaved changes. If you leave now, your changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={handleCancel}>
            Stay
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Leave without saving
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
