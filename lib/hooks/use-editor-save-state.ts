"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type EditorSaveStatus = "saved" | "dirty" | "saving" | "error"

export function useEditorSaveState(initialStatus: EditorSaveStatus = "saved") {
  const [status, setStatus] = useState<EditorSaveStatus>(initialStatus)
  const [lastSavedAt, setLastSavedAt] = useState<number | undefined>(undefined)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const pendingNavigateRef = useRef<(() => void) | null>(null)

  const setDirty = useCallback(() => {
    setStatus("dirty")
  }, [])

  const setSaving = useCallback(() => {
    setStatus("saving")
  }, [])

  const setSaved = useCallback(() => {
    setStatus("saved")
    setLastSavedAt(Date.now())
  }, [])

  const setError = useCallback(() => {
    setStatus("error")
  }, [])

  const confirmBeforeNavigate = useCallback((action: () => void) => {
    if (status !== "dirty") {
      action()
      return
    }
    pendingNavigateRef.current = action
    setLeaveDialogOpen(true)
  }, [status])

  const handleLeaveConfirm = useCallback(() => {
    setLeaveDialogOpen(false)
    const fn = pendingNavigateRef.current
    pendingNavigateRef.current = null
    if (fn) fn()
  }, [])

  const handleLeaveCancel = useCallback(() => {
    setLeaveDialogOpen(false)
    pendingNavigateRef.current = null
  }, [])

  useEffect(() => {
    if (status !== "dirty") return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [status])

  return {
    status,
    lastSavedAt,
    setDirty,
    setSaving,
    setSaved,
    setError,
    confirmBeforeNavigate,
    leaveDialogOpen,
    setLeaveDialogOpen,
    handleLeaveConfirm,
    handleLeaveCancel,
  }
}
