"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export interface ConfirmDestructiveDialogImpactItem {
  label: string
  value: number
}

export interface ConfirmDestructiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  /** Optional impact counts to show (e.g. "Plays to delete: 4") */
  impactItems?: ConfirmDestructiveDialogImpactItem[]
  /** Show loading state while impact data is being fetched */
  isLoadingImpact?: boolean
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive styling for confirm button (default true) */
  isDestructive?: boolean
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  /** When true, confirm button is disabled (e.g. deletion in progress) */
  isDeleting?: boolean
}

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  message,
  impactItems,
  isLoadingImpact,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isDestructive = true,
  onConfirm,
  onCancel,
  isDeleting = false,
}: ConfirmDestructiveDialogProps) {
  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const handleConfirm = async () => {
    await onConfirm()
    // Parent is responsible for closing (e.g. after successful delete + redirect)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className={isDestructive ? "text-red-700" : undefined}>
            {title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-slate-600">
            {message}
          </DialogDescription>
        </DialogHeader>
        {((impactItems && impactItems.length > 0) || isLoadingImpact) && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            {isLoadingImpact ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Calculating impact...</span>
              </div>
            ) : (
              <ul className="space-y-1 text-sm text-slate-700">
                {impactItems?.map((item, i) => (
                  <li key={i}>
                    <span className="font-medium">{item.label}:</span>{" "}
                    <span className="tabular-nums">{item.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isDeleting}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
