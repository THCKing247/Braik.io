"use client"

import { useState } from "react"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export function DevConsoleCopyButton({
  text,
  label = "Copy",
}: {
  text: string
  label?: string
}) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={cn(adminUi.btnSecondarySm, "font-mono")}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }}
    >
      {done ? "Copied" : label}
    </button>
  )
}
