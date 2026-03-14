"use client"

import React, { createContext, useCallback, useContext, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"

type ToastVariant = "success" | "error"

interface ToastState {
  message: string
  variant: ToastVariant
  id: number
}

const PlaybookToastContext = createContext<{
  showToast: (message: string, variant?: ToastVariant) => void
} | null>(null)

const TOAST_DURATION_MS = 5000

export function PlaybookToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [nextId, setNextId] = useState(0)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    const id = nextId
    setNextId((n) => n + 1)
    setToast({ message, variant, id })
    timeoutRef.current = setTimeout(() => {
      setToast(null)
      timeoutRef.current = null
    }, TOAST_DURATION_MS)
  }, [nextId])

  React.useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  return (
    <PlaybookToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-lg border shadow-lg px-4 py-3 min-w-[280px] max-w-[90vw] animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            backgroundColor: toast.variant === "success" ? "rgb(240 253 244)" : "rgb(254 226 226)",
            borderColor: toast.variant === "success" ? "rgb(34 197 94)" : "rgb(239 68 68)",
          }}
          role="alert"
        >
          {toast.variant === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 text-red-600" />
          )}
          <span
            className="text-sm font-medium"
            style={{
              color: toast.variant === "success" ? "rgb(22 101 52)" : "rgb(153 27 27)",
            }}
          >
            {toast.message}
          </span>
        </div>
      )}
    </PlaybookToastContext.Provider>
  )
}

export function usePlaybookToast() {
  const ctx = useContext(PlaybookToastContext)
  if (!ctx) {
    return {
      showToast: (message: string, _variant?: ToastVariant) => {
        if (typeof window !== "undefined") {
          // Fallback if used outside provider (e.g. in tests)
          console.info("[playbook toast]", message)
        }
      },
    }
  }
  return ctx
}
