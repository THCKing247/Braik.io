"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { emitTeamGamesChanged } from "@/lib/team-games-events"
import type { TeamGameRow } from "@/lib/team-schedule-games"
import { inferScheduleStatus } from "@/lib/team-schedule-games"
import {
  computePlayerOfTheGame,
  formatPlayerOfTheGameLine,
  type GameStatsRowInput,
} from "@/lib/schedule-player-of-game"
import { getStatNumber } from "@/lib/stats-helpers"
import { cn } from "@/lib/utils"

const GAME_STAT_EDIT_FIELDS: { key: string; label: string }[] = [
  { key: "passing_yards", label: "Pass Yds" },
  { key: "passing_touchdowns", label: "Pass TD" },
  { key: "int_thrown", label: "INT" },
  { key: "rushing_yards", label: "Rush Yds" },
  { key: "rushing_touchdowns", label: "Rush TD" },
  { key: "receptions", label: "Rec" },
  { key: "receiving_yards", label: "Rec Yds" },
  { key: "receiving_touchdowns", label: "Rec TD" },
  { key: "solo_tackles", label: "Solo" },
  { key: "assisted_tackles", label: "Ast" },
  { key: "sacks", label: "Sacks" },
  { key: "defensive_interceptions", label: "Def INT" },
  { key: "tackles_for_loss", label: "TFL" },
  { key: "field_goals_made", label: "FGM" },
]

type PanelPlayerStat = {
  playerId: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  imageUrl: string | null
  stats: Record<string, unknown>
}

type RosterRow = {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
}

type TabId = "game" | "players" | "recap"

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-[rgb(var(--accent))] text-white" : "border bg-white hover:bg-slate-50"
      )}
      style={!active ? { borderColor: "rgb(var(--border))", color: "rgb(var(--text))" } : undefined}
    >
      {children}
    </button>
  )
}

function statsToInputs(stats: Record<string, unknown>): Record<string, string> {
  const o: Record<string, string> = {}
  for (const { key } of GAME_STAT_EDIT_FIELDS) {
    const v = getStatNumber(stats, key)
    o[key] = v != null && v !== 0 ? String(v) : ""
  }
  return o
}

function inputsToStats(inputs: Record<string, string>): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const { key } of GAME_STAT_EDIT_FIELDS) {
    const s = inputs[key]?.trim() ?? ""
    if (s === "") continue
    const n = Number(s)
    if (!Number.isFinite(n)) continue
    o[key] = n
  }
  return o
}

function pickDisplayColumns(rows: PanelPlayerStat[]): string[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const s = r.stats || {}
    for (const k of GAME_STAT_EDIT_FIELDS.map((x) => x.key)) {
      const v = getStatNumber(s, k)
      if (v != null && v !== 0) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  const ordered = GAME_STAT_EDIT_FIELDS.map((f) => f.key).filter((k) => (counts.get(k) ?? 0) > 0)
  return ordered.slice(0, 8)
}

export function ScheduleGameDetailTabs({
  teamId,
  teamName,
  game,
  weekLabel,
  canEdit,
  onRefresh,
  gameTab,
}: {
  teamId: string
  teamName: string
  game: TeamGameRow
  weekLabel: string
  canEdit: boolean
  onRefresh: () => void
  gameTab: React.ReactNode
}) {
  const { showToast } = usePlaybookToast()
  const [tab, setTab] = useState<TabId>("game")
  const [panelLoading, setPanelLoading] = useState(false)
  const [panel, setPanel] = useState<{
    aiRecap: string | null
    aiRecapAt: string | null
    potgOverridePlayerId: string | null
    potgOverridePlayer: { id: string; firstName: string; lastName: string } | null
    playerStats: PanelPlayerStat[]
  } | null>(null)
  const [editRows, setEditRows] = useState<{ playerId: string; inputs: Record<string, string> }[]>([])
  const [editingStats, setEditingStats] = useState(false)
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [recapLoading, setRecapLoading] = useState(false)
  const [savingStats, setSavingStats] = useState(false)
  const [savingPotg, setSavingPotg] = useState(false)

  const completed = inferScheduleStatus(game) === "completed"

  const loadPanel = useCallback(async () => {
    setPanelLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/games/${game.id}/schedule-panel`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as { error?: string }).error || "Failed to load")
      setPanel({
        aiRecap: j.aiRecap ?? null,
        aiRecapAt: j.aiRecapAt ?? null,
        potgOverridePlayerId: j.potgOverridePlayerId ?? null,
        potgOverridePlayer: j.potgOverridePlayer ?? null,
        playerStats: Array.isArray(j.playerStats) ? j.playerStats : [],
      })
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Load failed", "error")
      setPanel(null)
    } finally {
      setPanelLoading(false)
    }
  }, [game.id, showToast, teamId])

  useEffect(() => {
    if (tab === "game") return
    if (!panel && !panelLoading) void loadPanel()
  }, [tab, panel, panelLoading, loadPanel])

  useEffect(() => {
    if (tab !== "players" || !canEdit || roster.length > 0) return
    fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}&lite=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows = d as RosterRow[] | undefined
        if (Array.isArray(rows)) setRoster(rows)
      })
      .catch(() => {})
  }, [tab, teamId, canEdit, roster.length])

  useEffect(() => {
    if (!panel?.playerStats) return
    setEditRows(
      panel.playerStats.map((p) => ({
        playerId: p.playerId,
        inputs: statsToInputs(p.stats),
      }))
    )
  }, [panel?.playerStats])

  const playerRowsForPotg: GameStatsRowInput[] = useMemo(() => {
    if (!panel?.playerStats) return []
    return panel.playerStats.map((p) => ({
      playerId: p.playerId,
      firstName: p.firstName,
      lastName: p.lastName,
      jerseyNumber: p.jerseyNumber,
      positionGroup: p.positionGroup,
      stats: p.stats,
    }))
  }, [panel?.playerStats])

  const autoPotg = useMemo(() => computePlayerOfTheGame(playerRowsForPotg), [playerRowsForPotg])

  const effectivePotg = useMemo(() => {
    if (!completed) return null
    if (panel?.potgOverridePlayer) {
      return {
        kind: "override" as const,
        line: `${panel.potgOverridePlayer.firstName} ${panel.potgOverridePlayer.lastName}`.trim(),
        detail: "Coach-selected Player of the Game.",
      }
    }
    if (autoPotg) {
      return {
        kind: "auto" as const,
        line: formatPlayerOfTheGameLine(autoPotg),
        detail: `Weighted score ${autoPotg.score} (pass/rush/rec + defense + negatives for turnovers).`,
      }
    }
    return null
  }, [autoPotg, completed, panel?.potgOverridePlayer])

  const displayCols = useMemo(() => pickDisplayColumns(panel?.playerStats ?? []), [panel?.playerStats])

  const savePlayerStats = async () => {
    setSavingStats(true)
    try {
      const rows = editRows.map((r) => ({
        playerId: r.playerId,
        stats: inputsToStats(r.inputs),
      }))
      const res = await fetch(`/api/teams/${teamId}/games/${game.id}/player-game-stats`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as { error?: string }).error || "Save failed")
      showToast("Player stats saved.", "success")
      emitTeamGamesChanged(teamId)
      setEditingStats(false)
      await loadPanel()
      onRefresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error")
    } finally {
      setSavingStats(false)
    }
  }

  const patchPotgOverride = async (playerId: string | null) => {
    setSavingPotg(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ potgOverridePlayerId: playerId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as { error?: string }).error || "Update failed")
      showToast(playerId ? "Player of the Game updated." : "Using automatic Player of the Game.", "success")
      await loadPanel()
      onRefresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed", "error")
    } finally {
      setSavingPotg(false)
    }
  }

  const generateRecap = async () => {
    setRecapLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/games/${game.id}/ai-recap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekLabel }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as { error?: string }).error || "Recap failed")
      showToast("Recap generated.", "success")
      setPanel((p) =>
        p
          ? {
              ...p,
              aiRecap: (j as { recap?: string }).recap ?? p.aiRecap,
              aiRecapAt: (j as { aiRecapAt?: string }).aiRecapAt ?? p.aiRecapAt,
            }
          : p
      )
      await loadPanel()
      onRefresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Recap failed", "error")
    } finally {
      setRecapLoading(false)
    }
  }

  const copyRecap = async () => {
    const t = panel?.aiRecap?.trim()
    if (!t) return
    try {
      await navigator.clipboard.writeText(t)
      showToast("Copied recap.", "success")
    } catch {
      showToast("Could not copy.", "error")
    }
  }

  const addStatRow = (playerId: string) => {
    if (editRows.some((r) => r.playerId === playerId)) return
    const empty: Record<string, string> = {}
    for (const { key } of GAME_STAT_EDIT_FIELDS) empty[key] = ""
    setEditRows((rows) => [...rows, { playerId, inputs: empty }])
  }

  const removeStatRow = (playerId: string) => {
    setEditRows((rows) => rows.filter((r) => r.playerId !== playerId))
  }

  const updateInput = (playerId: string, key: string, value: string) => {
    setEditRows((rows) =>
      rows.map((r) => (r.playerId === playerId ? { ...r, inputs: { ...r.inputs, [key]: value } } : r))
    )
  }

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "rgb(var(--border))" }}>
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "game"} onClick={() => setTab("game")}>
          Game
        </TabButton>
        <TabButton active={tab === "players"} onClick={() => setTab("players")}>
          Players & POTG
        </TabButton>
        <TabButton active={tab === "recap"} onClick={() => setTab("recap")}>
          AI recap
        </TabButton>
      </div>

      {tab === "game" && <div className="mt-4 space-y-4">{gameTab}</div>}

      {tab === "players" && (
        <div className="mt-4 space-y-4">
          {panelLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!panelLoading && completed && (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--snow))" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                Player of the Game
              </p>
              {effectivePotg ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  {(() => {
                    const potgPid = panel?.potgOverridePlayer?.id ?? autoPotg?.playerId
                    const img = potgPid ? panel?.playerStats.find((p) => p.playerId === potgPid)?.imageUrl : null
                    return img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={effectivePotg.line}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : null
                  })()}
                  <div>
                    <p className="font-semibold" style={{ color: "rgb(var(--text))" }}>
                      {effectivePotg.line}
                    </p>
                    <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                      {effectivePotg.detail}
                      {effectivePotg.kind === "auto" ? " Tie-break: TDs, yards, then name." : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
                  Player of the Game unavailable until player stats are entered.
                </p>
              )}
              {canEdit && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-xs font-medium" style={{ color: "rgb(var(--muted))" }}>
                    Override
                  </label>
                  <select
                    className="h-9 max-w-[220px] rounded-md border px-2 text-sm"
                    style={{ borderColor: "rgb(var(--border))" }}
                    disabled={savingPotg}
                    value={panel?.potgOverridePlayerId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value
                      void patchPotgOverride(v === "" ? null : v)
                    }}
                  >
                    <option value="">Automatic</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.jerseyNumber ?? "—"} {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
              Player stats
            </p>
            {canEdit && completed && (
              <div className="flex gap-2">
                {!editingStats ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingStats(true)}>
                    {panel?.playerStats.length ? "Edit player stats" : "Enter player stats"}
                  </Button>
                ) : (
                  <>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingStats(false)}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" disabled={savingStats} onClick={() => void savePlayerStats()}>
                      {savingStats ? "Saving…" : "Save stats"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {!completed && (
            <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
              Player stats are typically entered after the game is final.
            </p>
          )}

          {completed && !editingStats && panel && (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "rgb(var(--border))" }}>
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                    <th className="px-2 py-2 font-medium" style={{ color: "rgb(var(--muted))" }}>
                      Player
                    </th>
                    {displayCols.map((k) => (
                      <th key={k} className="px-2 py-2 font-medium tabular-nums" style={{ color: "rgb(var(--muted))" }}>
                        {GAME_STAT_EDIT_FIELDS.find((f) => f.key === k)?.label ?? k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {panel.playerStats.length === 0 ? (
                    <tr>
                      <td colSpan={1 + displayCols.length} className="px-2 py-4 text-center text-muted-foreground">
                        No player stats for this game yet.
                      </td>
                    </tr>
                  ) : (
                    panel.playerStats.map((p) => (
                      <tr key={p.playerId} style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                        <td className="px-2 py-2 font-medium" style={{ color: "rgb(var(--text))" }}>
                          <span className="tabular-nums text-muted-foreground">#{p.jerseyNumber ?? "—"}</span>{" "}
                          {p.firstName} {p.lastName}
                          {p.positionGroup ? (
                            <span className="ml-1 text-xs text-muted-foreground">({p.positionGroup})</span>
                          ) : null}
                        </td>
                        {displayCols.map((k) => (
                          <td key={k} className="px-2 py-2 tabular-nums" style={{ color: "rgb(var(--text2))" }}>
                            {getStatNumber(p.stats, k) ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {completed && editingStats && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Add player</label>
                  <select
                    className="mt-1 flex h-9 min-w-[200px] rounded-md border border-border bg-background px-2 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      const v = e.target.value
                      if (v) addStatRow(v)
                      e.target.value = ""
                    }}
                  >
                    <option value="">Select roster player…</option>
                    {roster
                      .filter((p) => !editRows.some((r) => r.playerId === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber ?? "—"} {p.firstName} {p.lastName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {editRows.map((row) => {
                const fromRoster = roster.find((x) => x.id === row.playerId)
                const fromPanel = panel?.playerStats.find((x) => x.playerId === row.playerId)
                const label = fromRoster
                  ? `${fromRoster.firstName} ${fromRoster.lastName}`
                  : fromPanel
                    ? `${fromPanel.firstName} ${fromPanel.lastName}`
                    : row.playerId
                return (
                  <div
                    key={row.playerId}
                    className="rounded-lg border p-3"
                    style={{ borderColor: "rgb(var(--border))" }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                        {label}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeStatRow(row.playerId)}>
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                      {GAME_STAT_EDIT_FIELDS.map(({ key, label: lb }) => (
                        <div key={key} className="space-y-0.5">
                          <label className="text-[10px] text-muted-foreground">{lb}</label>
                          <Input
                            inputMode="decimal"
                            className="h-8 text-sm"
                            value={row.inputs[key] ?? ""}
                            onChange={(e) => updateInput(row.playerId, key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === "recap" && (
        <div className="mt-4 space-y-3">
          {!completed && (
            <p className="text-sm text-muted-foreground">AI recap is available after the game is final.</p>
          )}
          {completed && panelLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {completed && !panelLoading && (
            <>
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <Button type="button" size="sm" disabled={recapLoading} onClick={() => void generateRecap()}>
                    {recapLoading ? "Generating…" : panel?.aiRecap ? "Regenerate recap" : "Generate recap"}
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" disabled={!panel?.aiRecap} onClick={() => void copyRecap()}>
                  Copy recap
                </Button>
              </div>
              {panel?.aiRecapAt ? (
                <p className="text-[11px] text-muted-foreground">Last updated: {new Date(panel.aiRecapAt).toLocaleString()}</p>
              ) : null}
              <div
                className="rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF", color: "rgb(var(--text))" }}
              >
                {panel?.aiRecap?.trim() ? panel.aiRecap : "No recap yet."}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Recap uses only scores, quarters, roster stats, trends, and Player of the Game data on file.{" "}
                {teamName} vs {game.opponent?.trim() || "opponent"}.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
