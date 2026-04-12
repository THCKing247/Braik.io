"use client"

import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"

export type FileDropZoneProps = {
  /** Shown on the hidden input (e.g. ".csv,text/csv") */
  acceptMime?: string
  disabled?: boolean
  /** Called when a valid CSV is chosen, or when the selection is cleared */
  onFileChange: (file: File | null) => void
  /** Wrong type — previous file (if any) is kept */
  onInvalidFile?: (message: string) => void
  /** Inline message below the zone (invalid type, etc.) */
  error?: string | null
  className?: string
  /** Shown inside the drop zone */
  label?: string
}

function isAllowedCsv(file: File): boolean {
  const lower = file.name.toLowerCase()
  if (lower.endsWith(".csv")) return true
  const t = (file.type || "").toLowerCase()
  return t === "text/csv" || t === "application/csv" || t === "application/vnd.ms-excel"
}

/**
 * Accessible drag-and-drop (or click) file target. Validates CSV by extension/MIME for schedule import;
 * pass a different validator later by wrapping onFileChange.
 */
export function FileDropZone({
  acceptMime = ".csv,text/csv",
  disabled = false,
  onFileChange,
  onInvalidFile,
  error,
  className,
  label = "Drag & drop CSV here or click to upload",
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const labelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  const openPicker = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const applyFile = useCallback(
    (file: File | null) => {
      if (!file) {
        onFileChange(null)
        if (inputRef.current) inputRef.current.value = ""
        return
      }
      if (!isAllowedCsv(file)) {
        onInvalidFile?.("Please choose a .csv file.")
        if (inputRef.current) inputRef.current.value = ""
        return
      }
      onFileChange(file)
    },
    [onFileChange, onInvalidFile]
  )

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null
      applyFile(f)
    },
    [applyFile]
  )

  const onDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = e.relatedTarget as Node | null
    if (next && rootRef.current?.contains(next)) return
    setIsDragging(false)
  }, [])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (disabled) return
      const f = e.dataTransfer.files?.[0]
      applyFile(f ?? null)
    },
    [applyFile, disabled]
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        openPicker()
      }
    },
    [disabled, openPicker]
  )

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptMime}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={handleInputChange}
      />
      <div
        ref={rootRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-disabled={disabled}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none",
          "border-[rgb(var(--border))] bg-[rgb(var(--snow))]",
          "hover:border-[rgb(var(--accent))]/50 hover:bg-[rgb(var(--platinum))]/30",
          "focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50",
          isDragging && "border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/8 ring-2 ring-[rgb(var(--accent))]/20"
        )}
        onClick={() => openPicker()}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Upload
          className="h-9 w-9 shrink-0"
          style={{ color: "rgb(var(--accent))" }}
          aria-hidden
        />
        <p id={labelId} className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
          {label}
        </p>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Use in parents if you validate outside the drop zone */
export function validateCsvFile(file: File): true | string {
  if (!isAllowedCsv(file)) {
    return "Please choose a .csv file."
  }
  return true
}
