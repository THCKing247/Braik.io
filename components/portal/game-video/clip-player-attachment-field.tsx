"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type LitePlayer = {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
}

function labelForPlayer(p: LitePlayer): string {
  const num = p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""
  const pos = p.positionGroup?.trim() ? ` · ${p.positionGroup}` : ""
  return `${num}${p.firstName} ${p.lastName}${pos}`.trim()
}

export function ClipPlayerAttachmentField({
  teamId,
  selectedIds,
  onChange,
  disabled,
  heading = "Players in this clip",
  description = "Attach roster athletes so this clip appears on their profile and recruiting film. Search and add multiple.",
}: {
  teamId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  /** Override default clip-oriented copy when attaching at film level vs clip level. */
  heading?: string
  description?: string
}) {
  const [roster, setRoster] = useState<LitePlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}&lite=1`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Roster failed"))))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setRoster(data as LitePlayer[])
      })
      .catch(() => {
        if (!cancelled) setRoster([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const selectedPlayers = useMemo(
    () => selectedIds.map((id) => roster.find((p) => p.id === id)).filter(Boolean) as LitePlayer[],
    [selectedIds, roster],
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return roster.filter((p) => !selectedSet.has(p.id))
    return roster.filter((p) => {
      if (selectedSet.has(p.id)) return false
      const hay = `${p.firstName} ${p.lastName} ${p.jerseyNumber ?? ""} ${p.positionGroup ?? ""}`.toLowerCase()
      return hay.includes(s)
    })
  }, [roster, q, selectedSet])

  const addPlayer = useCallback(
    (id: string) => {
      if (selectedSet.has(id)) return
      onChange([...selectedIds, id])
      setQ("")
    },
    [selectedIds, selectedSet, onChange],
  )

  const removePlayer = useCallback(
    (id: string) => {
      onChange(selectedIds.filter((x) => x !== id))
    },
    [selectedIds, onChange],
  )

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold text-foreground">{heading}</h4>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{description}</p>
      </div>

      {selectedPlayers.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selectedPlayers.map((p) => (
            <li
              key={p.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1 text-xs font-semibold text-foreground"
            >
              <span className="truncate">{labelForPlayer(p)}</span>
              <button
                type="button"
                disabled={disabled}
                className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                onClick={() => removePlayer(p.id)}
                aria-label={`Remove ${p.firstName} ${p.lastName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input
          className="min-h-[44px]"
          placeholder={loading ? "Loading roster…" : "Search roster to add players…"}
          value={q}
          disabled={disabled || loading}
          onChange={(e) => setQ(e.target.value)}
          aria-autocomplete="list"
          aria-expanded={filtered.length > 0 && q.trim().length > 0}
        />
        {q.trim() && filtered.length > 0 && (
          <ul
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
            role="listbox"
          >
            {filtered.slice(0, 40).map((p) => (
              <li key={p.id} role="option">
                <button
                  type="button"
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted",
                  )}
                  onClick={() => addPlayer(p.id)}
                >
                  {labelForPlayer(p)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
