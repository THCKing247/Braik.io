"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Plus,
  Pencil,
  Trash2,
  Trophy,
} from "lucide-react"

type TabId = "schedule" | "maxes" | "leaderboard" | "achievements"

const TAB_DEFS: { id: TabId; label: string }[] = [
  { id: "schedule", label: "Schedule" },
  { id: "maxes", label: "Player Maxes" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "achievements", label: "Achievements" },
]

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const LIFT_TYPES = ["BENCH", "SQUAT", "CLEAN", "DEADLIFT"] as const

interface WorkoutSessionRow {
  id: string
  team_id: string
  day_of_week: number
  title: string
  description: string | null
  start_time: string
  duration_minutes: number
  position_groups: string[] | unknown
}

interface PlayerMaxRow {
  id: string
  player_id: string
  lift_type: string
  weight_lbs: number
  logged_date: string
  notes: string | null
  created_at: string
}

interface LitePlayer {
  id: string
  firstName: string
  lastName: string
  position_group: string | null
}

export function WeightRoomModule({ teamId }: { teamId: string }) {
  const [tab, setTab] = useState<TabId>("schedule")
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([])
  const [maxes, setMaxes] = useState<PlayerMaxRow[]>([])
  const [roster, setRoster] = useState<LitePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const base = `/api/teams/${encodeURIComponent(teamId)}/weight-room`

  const loadSchedule = useCallback(async () => {
    const res = await fetch(`${base}/schedule`)
    if (!res.ok) throw new Error("Failed to load schedule")
    const data = await res.json()
    setSessions(data.sessions ?? [])
  }, [base])

  const loadMaxes = useCallback(async () => {
    const res = await fetch(`${base}/maxes`)
    if (!res.ok) throw new Error("Failed to load maxes")
    const data = await res.json()
    setMaxes(data.maxes ?? [])
  }, [base])

  const loadRoster = useCallback(async () => {
    const res = await fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}&lite=1`)
    if (!res.ok) return
    const data = await res.json()
    const players = Array.isArray(data) ? data : []
    setRoster(
      players.map((p: { id: string; firstName?: string; lastName?: string; positionGroup?: string | null }) => ({
        id: p.id,
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        position_group: p.positionGroup ?? null,
      }))
    )
  }, [teamId])

  useEffect(() => {
    setLoading(true)
    setErr(null)
    Promise.all([loadSchedule(), loadMaxes(), loadRoster()])
      .catch((e) => setErr(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false))
  }, [loadSchedule, loadMaxes, loadRoster])

  const positionOptions = useMemo(() => {
    const s = new Set<string>()
    roster.forEach((p) => {
      if (p.position_group?.trim()) s.add(p.position_group.trim())
    })
    return [...s].sort()
  }, [roster])

  const byDay = useMemo(() => {
    const m: Record<number, WorkoutSessionRow[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    sessions.forEach((s) => {
      const d = s.day_of_week
      if (m[d]) m[d].push(s)
    })
    Object.keys(m).forEach((k) => {
      m[Number(k)].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
    })
    return m
  }, [sessions])

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-4 px-4 pb-8 md:px-0">
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Weight room</h1>
          <p className="mt-1 text-sm text-[#64748B]">Schedule, maxes, and team strength leaderboard.</p>
        </div>
        <WeightRoomToolbar
          teamId={teamId}
          tab={tab}
          maxes={maxes}
          onRefresh={async () => {
            await loadSchedule()
            await loadMaxes()
          }}
        />
      </div>

      <PortalUnderlineTabs
        tabs={TAB_DEFS}
        value={tab}
        onValueChange={(id) => setTab(id as TabId)}
        ariaLabel="Weight room sections"
      />

      {err && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {err}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#0B2A5B] border-t-transparent" />
        </div>
      ) : (
        <>
          {tab === "schedule" && (
            <ScheduleTab
              teamId={teamId}
              base={base}
              byDay={byDay}
              roster={roster}
              positionOptions={positionOptions}
              onRefresh={loadSchedule}
            />
          )}
          {tab === "maxes" && (
            <MaxesTab
              base={base}
              maxes={maxes}
              roster={roster}
              positionOptions={positionOptions}
              onRefresh={loadMaxes}
            />
          )}
          {tab === "leaderboard" && <LeaderboardTab base={base} positionOptions={positionOptions} />}
          {tab === "achievements" && <AchievementsTab base={base} />}
        </>
      )}
    </div>
  )
}

function WeightRoomToolbar({
  teamId,
  tab,
  maxes,
  onRefresh,
}: {
  teamId: string
  tab: TabId
  maxes: PlayerMaxRow[]
  onRefresh: () => Promise<void>
}) {
  const exportCsv = () => {
    const rows = [["playerId", "liftType", "weightLbs", "loggedDate", "notes"]]
    maxes.forEach((m) => {
      rows.push([m.player_id, m.lift_type, String(m.weight_lbs), m.logged_date, (m.notes ?? "").replace(/\n/g, " ")])
    })
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `weight-maxes-${teamId}-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => onRefresh()}>
        Refresh
      </Button>
      {tab === "maxes" && (
        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={exportCsv}>
          <Download className="mr-1 h-4 w-4" />
          Export CSV
        </Button>
      )}
    </div>
  )
}

function ScheduleTab({
  teamId,
  base,
  byDay,
  roster,
  positionOptions,
  onRefresh,
}: {
  teamId: string
  base: string
  byDay: Record<number, WorkoutSessionRow[]>
  roster: LitePlayer[]
  positionOptions: string[]
  onRefresh: () => Promise<void>
}) {
  const [editor, setEditor] = useState<WorkoutSessionRow | "new" | null>(null)
  const [attSession, setAttSession] = useState<WorkoutSessionRow | null>(null)
  const [attDate, setAttDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [attMap, setAttMap] = useState<Record<string, "present" | "absent">>({})

  useEffect(() => {
    if (!attSession || !attDate) return
    let cancelled = false
    fetch(`${base}/attendance?sessionId=${encodeURIComponent(attSession.id)}&attendanceDate=${encodeURIComponent(attDate)}`)
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((d: { records?: { player_id: string; status: string }[] }) => {
        if (cancelled) return
        const next: Record<string, "present" | "absent"> = {}
        ;(d.records ?? []).forEach((r) => {
          next[r.player_id] = r.status === "absent" ? "absent" : "present"
        })
        setAttMap(next)
      })
    return () => {
      cancelled = true
    }
  }, [attSession, attDate, base])

  const saveAttendance = async () => {
    if (!attSession) return
    const records = roster.map((p) => ({
      playerId: p.id,
      status: attMap[p.id] ?? "present",
    }))
    const res = await fetch(`${base}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: attSession.id, attendanceDate: attDate, records }),
    })
    if (!res.ok) alert("Failed to save attendance")
    else await onRefresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="rounded-lg" onClick={() => setEditor("new")}>
          <Plus className="mr-1 h-4 w-4" />
          Add Session
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {DAY_LABELS.map((label, day) => (
          <Card key={label} className="min-h-[140px] border-[#E5E7EB]">
            <CardContent className="p-3">
              <p className="mb-2 text-center text-xs font-bold uppercase text-[#64748B]">{label}</p>
              <div className="space-y-2">
                {(byDay[day] ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-2 text-xs"
                  >
                    <p className="font-semibold text-[#0F172A]">{s.title}</p>
                    <p className="text-[#64748B]">
                      {String(s.start_time).slice(0, 5)} · {s.duration_minutes}m
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-[11px]"
                        onClick={() => setEditor(s)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-[11px]"
                        onClick={() => setAttSession(s)}
                      >
                        <Calendar className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-[11px] text-red-600"
                        onClick={async () => {
                          if (!confirm("Delete this session block?")) return
                          const res = await fetch(`${base}/schedule/${s.id}`, { method: "DELETE" })
                          if (res.ok) await onRefresh()
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SessionDialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        base={base}
        session={editor === "new" ? null : editor}
        positionOptions={positionOptions}
        onSaved={async () => {
          setEditor(null)
          await onRefresh()
        }}
      />

      <Dialog open={!!attSession} onOpenChange={() => setAttSession(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Attendance — {attSession?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className="mt-1" />
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {roster.map((p) => (
                <label key={p.id} className="flex items-center justify-between gap-2 rounded border border-[#E5E7EB] px-2 py-1.5">
                  <span className="text-sm">
                    {p.lastName}, {p.firstName}
                  </span>
                  <select
                    className="h-8 w-28 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
                    value={attMap[p.id] ?? "present"}
                    onChange={(e) =>
                      setAttMap((m) => ({ ...m, [p.id]: e.target.value as "present" | "absent" }))
                    }
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttSession(null)}>
              Close
            </Button>
            <Button type="button" onClick={saveAttendance}>
              Save attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SessionDialog({
  open,
  onClose,
  base,
  session,
  positionOptions,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  base: string
  session: WorkoutSessionRow | null
  positionOptions: string[]
  onSaved: () => Promise<void>
}) {
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startTime, setStartTime] = useState("07:00")
  const [duration, setDuration] = useState(60)
  const [groups, setGroups] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (session) {
      setDayOfWeek(session.day_of_week)
      setTitle(session.title)
      setDescription(session.description ?? "")
      setStartTime(String(session.start_time).slice(0, 5))
      setDuration(session.duration_minutes)
      setGroups(Array.isArray(session.position_groups) ? (session.position_groups as string[]) : [])
    } else {
      setDayOfWeek(1)
      setTitle("")
      setDescription("")
      setStartTime("07:00")
      setDuration(60)
      setGroups([])
    }
  }, [open, session])

  const toggleGroup = (g: string) => {
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        dayOfWeek,
        title,
        description,
        startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
        durationMinutes: duration,
        positionGroups: groups,
      }
      const url = session ? `${base}/schedule/${session.id}` : `${base}/schedule`
      const res = await fetch(url, {
        method: session ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? "Save failed")
        return
      }
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{session ? "Edit session" : "Add session"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Day</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
              value={String(dayOfWeek)}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {DAY_LABELS.map((d, i) => (
                <option key={d} value={String(i)}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Title</Label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Start</Label>
              <Input className="mt-1" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input
                className="mt-1"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <Label>Position groups (optional)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {positionOptions.map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={groups.includes(g)} onCheckedChange={() => toggleGroup(g)} />
                  {g}
                </label>
              ))}
              {positionOptions.length === 0 && (
                <span className="text-xs text-[#64748B]">No position groups on roster yet — leave all unchecked for whole team.</span>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !title.trim()} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MaxesTab({
  base,
  maxes,
  roster,
  positionOptions,
  onRefresh,
}: {
  base: string
  maxes: PlayerMaxRow[]
  roster: LitePlayer[]
  positionOptions: string[]
  onRefresh: () => Promise<void>
}) {
  const [liftFilter, setLiftFilter] = useState<string>("ALL")
  const [posFilter, setPosFilter] = useState<string>("ALL")
  const [openId, setOpenId] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(false)

  const byPlayer = useMemo(() => {
    const m = new Map<string, PlayerMaxRow[]>()
    maxes.forEach((x) => {
      const arr = m.get(x.player_id) ?? []
      arr.push(x)
      m.set(x.player_id, arr)
    })
    m.forEach((arr) => arr.sort((a, b) => new Date(b.logged_date).getTime() - new Date(a.logged_date).getTime()))
    return m
  }, [maxes])

  const filteredRoster = roster.filter((p) => (posFilter === "ALL" ? true : (p.position_group ?? "") === posFilter))

  const currentFor = (pid: string, lift: string) => {
    const rows = (byPlayer.get(pid) ?? []).filter((r) => r.lift_type === lift)
    return rows[0] ?? null
  }
  const prevFor = (pid: string, lift: string) => {
    const rows = (byPlayer.get(pid) ?? []).filter((r) => r.lift_type === lift)
    return rows[1] ?? null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Lift</Label>
          <select
            className="mt-1 h-10 w-40 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
            value={liftFilter}
            onChange={(e) => setLiftFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            {LIFT_TYPES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Position</Label>
          <select
            className="mt-1 h-10 w-44 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            {positionOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" className="rounded-lg" onClick={() => setLogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Log Max
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs font-semibold uppercase text-[#64748B]">
            <tr>
              <th className="px-3 py-2">Player</th>
              {LIFT_TYPES.map((l) => (
                <th key={l} className="px-3 py-2">
                  {l}
                </th>
              ))}
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {filteredRoster.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-t border-[#E5E7EB]">
                  <td className="px-3 py-2 font-medium text-[#0F172A]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left hover:text-[#3B82F6]"
                      onClick={() => setOpenId((id) => (id === p.id ? null : p.id))}
                    >
                      {openId === p.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {p.lastName}, {p.firstName}
                    </button>
                  </td>
                  {LIFT_TYPES.map((l) => {
                    if (liftFilter !== "ALL" && liftFilter !== l) {
                      return <td key={l} className="px-3 py-2 text-[#94A3B8]">—</td>
                    }
                    const cur = currentFor(p.id, l)
                    const prev = prevFor(p.id, l)
                    let icon = null as React.ReactNode
                    if (cur && prev) {
                      if (cur.weight_lbs > prev.weight_lbs) icon = <ArrowUp className="inline h-3.5 w-3.5 text-green-600" />
                      else if (cur.weight_lbs < prev.weight_lbs) icon = <ArrowDown className="inline h-3.5 w-3.5 text-red-500" />
                      else icon = <span className="text-[#94A3B8">·</span>
                    }
                    return (
                      <td key={l} className="px-3 py-2 tabular-nums">
                        {cur ? (
                          <span>
                            {cur.weight_lbs} {icon}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )
                  })}
                  <td />
                </tr>
                {openId === p.id && (
                  <tr className="bg-[#FAFAFA]">
                    <td colSpan={6} className="px-3 py-2 text-xs text-[#64748B]">
                      <ul className="list-inside list-disc space-y-1">
                        {(byPlayer.get(p.id) ?? []).map((r) => (
                          <li key={r.id}>
                            {r.lift_type} — {r.weight_lbs} lbs @ {r.logged_date}
                            {r.notes ? ` — ${r.notes}` : ""}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <LogMaxDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        base={base}
        roster={roster}
        onSaved={async () => {
          setLogOpen(false)
          await onRefresh()
        }}
      />
    </div>
  )
}

function LogMaxDialog({
  open,
  onClose,
  base,
  roster,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  base: string
  roster: LitePlayer[]
  onSaved: () => Promise<void>
}) {
  const [playerId, setPlayerId] = useState("")
  const [lift, setLift] = useState<string>("BENCH")
  const [weight, setWeight] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!playerId || !weight) return
    setSaving(true)
    try {
      const res = await fetch(`${base}/maxes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          liftType: lift,
          weightLbs: Number(weight),
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? "Failed")
        return
      }
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log max</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Player</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              <option value="">Select player</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName}, {p.firstName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Lift</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
              value={lift}
              onChange={(e) => setLift(e.target.value)}
            >
              {LIFT_TYPES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Weight (lbs)</Label>
            <Input className="mt-1" type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeaderboardTab({
  base,
  positionOptions,
}: {
  base: string
  positionOptions: string[]
}) {
  const [scope, setScope] = useState<"overall" | "position">("overall")
  const [pos, setPos] = useState<string>("")
  const [data, setData] = useState<{
    overall: { rank: number; name: string; combined: number; bench: number; squat: number; clean: number; dead: number }[]
  } | null>(null)

  useEffect(() => {
    if (scope === "position" && !pos) {
      setData(null)
      return
    }
    const q =
      scope === "position" && pos
        ? `?scope=position&positionGroup=${encodeURIComponent(pos)}`
        : "?scope=overall"
    fetch(`${base}/leaderboard${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
  }, [base, scope, pos])

  const rows = data?.overall ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="sm"
          variant={scope === "overall" ? "default" : "outline"}
          className="rounded-lg"
          onClick={() => setScope("overall")}
        >
          Overall
        </Button>
        <Button
          type="button"
          size="sm"
          variant={scope === "position" ? "default" : "outline"}
          className="rounded-lg"
          onClick={() => setScope("position")}
        >
          By position group
        </Button>
        {scope === "position" && (
          <select
            className="h-10 w-48 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
            value={pos}
            onChange={(e) => setPos(e.target.value)}
          >
            <option value="">Position group</option>
            {positionOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-[#0F172A]">Combined total (all four lifts)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name + r.rank} className="border-t border-[#E5E7EB]">
                  <td className="px-4 py-2">{r.rank}</td>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 tabular-nums">{r.combined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function AchievementsTab({ base }: { base: string }) {
  const [data, setData] = useState<{ thousandLbClub: { name: string; combinedThree: number }[]; recentPRs: unknown[] } | null>(
    null
  )
  useEffect(() => {
    fetch(`${base}/achievements`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
  }, [base])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-4">
          <h3 className="mb-2 font-semibold text-[#0F172A]">1000 lb Club (Bench + Squat + Clean)</h3>
          <ul className="space-y-1 text-sm">
            {(data?.thousandLbClub ?? []).map((p) => (
              <li key={p.name} className="flex justify-between gap-2">
                <span>{p.name}</span>
                <span className="tabular-nums text-[#64748B]">{p.combinedThree} lbs</span>
              </li>
            ))}
            {(data?.thousandLbClub ?? []).length === 0 && (
              <li className="text-[#64748B]">No players at 1,000+ lbs combined yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-4">
          <h3 className="mb-2 font-semibold text-[#0F172A]">Recent PRs</h3>
          <ul className="space-y-1 text-xs text-[#64748B]">
            {(data?.recentPRs as { liftType: string; weightLbs: number }[] | undefined)?.slice(0, 12).map((p, i) => (
              <li key={i}>
                {p.liftType} — {p.weightLbs} lbs
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
