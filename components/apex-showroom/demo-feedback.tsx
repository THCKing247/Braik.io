"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type Ctx = { notify: (message: string) => void }

const DemoFeedbackContext = createContext<Ctx | null>(null)

export function DemoFeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const clearT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((msg: string) => {
    if (clearT.current) clearTimeout(clearT.current)
    setMessage(msg)
    clearT.current = setTimeout(() => {
      setMessage(null)
      clearT.current = null
    }, 3400)
  }, [])

  useEffect(() => {
    return () => {
      if (clearT.current) clearTimeout(clearT.current)
    }
  }, [])

  return (
    <DemoFeedbackContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed bottom-0 left-0 right-0 z-[200] flex justify-center p-4 transition-opacity duration-300",
          message ? "opacity-100" : "opacity-0",
        )}
      >
        {message ? (
          <div className="max-w-lg rounded-xl border border-sky-500/30 bg-slate-950/95 px-4 py-2.5 text-center text-sm font-medium text-slate-100 shadow-2xl shadow-sky-950/40 ring-1 ring-white/10 backdrop-blur-md">
            <span className="text-sky-300">Demo:</span> {message}
          </div>
        ) : (
          <span className="sr-only" />
        )}
      </div>
    </DemoFeedbackContext.Provider>
  )
}

export function useDemoFeedback() {
  const c = useContext(DemoFeedbackContext)
  if (!c) {
    return { notify: (_: string) => {} }
  }
  return c
}
