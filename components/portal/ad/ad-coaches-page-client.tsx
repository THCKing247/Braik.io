"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  AdAssistantCoachAssignmentRow,
  AdCoachAssignmentsPicklistTeam,
  AdHeadCoachAssignmentRow,
} from "@/lib/ad-portal-coach-assignments"

type Props = {
  headRows: AdHeadCoachAssignmentRow[]
  assistantRows: AdAssistantCoachAssignmentRow[]
  teamsPicklist: AdCoachAssignmentsPicklistTeam[]
}

function displayCoachName(row: { fullName: string | null; email: string | null }) {
  const n = row.fullName?.trim()
  if (n) return n
  const e = row.email?.trim()
  if (e) return e
  return "—"
}

const tableWrap = "rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden"
const th = "px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider"
const td = "px-4 py-3 text-sm"

export function AdCoachesPageClient({ headRows, assistantRows, teamsPicklist }: Props) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteTeamId, setInviteTeamId] = useState("")
  const [inviteRole, setInviteRole] = useState<"head_coach" | "assistant_coach">("head_coach")
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editKind, setEditKind] = useState<"head" | "assistant" | "vacant" | null>(null)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editSourceTeamId, setEditSourceTeamId] = useState("")
  const [editTeamName, setEditTeamName] = useState("")
  const [editFullName, setEditFullName] = useState("")
  const [editTargetTeamId, setEditTargetTeamId] = useState("")
  const [editRole, setEditRole] = useState<"head_coach" | "assistant_coach">("head_coach")
  const [editVacantEmail, setEditVacantEmail] = useState("")
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState("")

  const openInvite = useCallback(() => {
    setInviteError("")
    setInviteCode(null)
    setInviteTeamId(teamsPicklist[0]?.id ?? "")
    setInviteRole("head_coach")
    setInviteOpen(true)
  }, [teamsPicklist])

  const submitInvite = async () => {
    setInviteError("")
    setInviteCode(null)
    if (!inviteTeamId) {
      setInviteError("Select a team.")
      return
    }
    setInviteBusy(true)
    try {
      const res = await fetch("/api/ad/coach-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: inviteTeamId,
          roleType: inviteRole,
          expiresInDays: 14,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setInviteError((data as { error?: string }).error ?? "Failed to create invite.")
        return
      }
      setInviteCode(String((data as { code?: string }).code ?? ""))
      router.refresh()
    } catch {
      setInviteError("Something went wrong.")
    } finally {
      setInviteBusy(false)
    }
  }

  const openEditHead = (row: AdHeadCoachAssignmentRow) => {
    setEditError("")
    if (!row.userId) {
      setEditKind("vacant")
      setEditUserId(null)
      setEditSourceTeamId(row.teamId)
      setEditTeamName(row.teamName)
      setEditVacantEmail("")
      setEditOpen(true)
      return
    }
    setEditKind("head")
    setEditUserId(row.userId)
    setEditSourceTeamId(row.teamId)
    setEditTeamName(row.teamName)
    setEditFullName(row.fullName?.trim() ?? "")
    setEditTargetTeamId(row.teamId)
    setEditRole("head_coach")
    setEditOpen(true)
  }

  const openEditAssistant = (row: AdAssistantCoachAssignmentRow) => {
    setEditError("")
    setEditKind("assistant")
    setEditUserId(row.userId)
    setEditSourceTeamId(row.teamId)
    setEditTeamName(row.teamName)
    setEditFullName(row.fullName?.trim() ?? "")
    setEditTargetTeamId(row.teamId)
    setEditRole("assistant_coach")
    setEditOpen(true)
  }

  const submitEdit = async () => {
    setEditError("")
    if (editKind === "vacant") {
      if (!editVacantEmail.trim()) {
        setEditError("Enter the coach account email.")
        return
      }
      setEditBusy(true)
      try {
        const res = await fetch("/api/ad/coach-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: editSourceTeamId, coachEmail: editVacantEmail.trim() }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setEditError((data as { error?: string }).error ?? "Failed to assign.")
          return
        }
        setEditOpen(false)
        router.refresh()
      } catch {
        setEditError("Something went wrong.")
      } finally {
        setEditBusy(false)
      }
      return
    }

    if (!editUserId) return
    setEditBusy(true)
    try {
      const res = await fetch("/api/ad/coach-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editUserId,
          sourceTeamId: editSourceTeamId,
          fullName: editFullName.trim() || null,
          targetTeamId: editTargetTeamId,
          role: editRole,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEditError((data as { error?: string }).error ?? "Failed to save.")
        return
      }
      setEditOpen(false)
      router.refresh()
    } catch {
      setEditError("Something went wrong.")
    } finally {
      setEditBusy(false)
    }
  }

  const sortedHead = [...headRows].sort((a, b) =>
    a.teamName.localeCompare(b.teamName, undefined, { sensitivity: "base" })
  )
  const sortedAsst = [...assistantRows]

  const hasTeams = teamsPicklist.length > 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#212529]">Coaches</h1>
          <p className="mt-1 text-[#6B7280]">
            Team-level head and assistant assignments. Use Invite to send a code; use Edit to update assignments.
          </p>
        </div>
        {hasTeams ? (
          <Button
            type="button"
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
            onClick={openInvite}
          >
            Invite coach
          </Button>
        ) : null}
      </div>

      {!hasTeams ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] p-12 text-center text-[#6B7280] text-sm">
          No teams in your view yet. Teams must appear in the Teams tab before coach assignments show here.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#212529]">Head coach assignments</h2>
            <div className={tableWrap}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E5E7EB]">
                  <thead className="bg-[#F9FAFB]">
                    <tr>
                      <th className={th}>Team</th>
                      <th className={th}>Coach</th>
                      <th className={th}>Email</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] bg-white">
                    {sortedHead.map((row) => (
                      <tr key={row.teamId}>
                        <td className={`${td} font-medium text-[#212529]`}>{row.teamName}</td>
                        <td className={td}>{row.userId ? displayCoachName(row) : <span className="text-[#9CA3AF]">Vacant</span>}</td>
                        <td className={`${td} text-[#6B7280]`}>{row.email?.trim() ? row.email : "—"}</td>
                        <td className={`${td} text-right`}>
                          <button
                            type="button"
                            className="text-sm font-medium text-[#3B82F6] hover:underline"
                            onClick={() => openEditHead(row)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[#212529]">Assistant coach assignments</h2>
            <div className={tableWrap}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E5E7EB]">
                  <thead className="bg-[#F9FAFB]">
                    <tr>
                      <th className={th}>Team</th>
                      <th className={th}>Coach</th>
                      <th className={th}>Email</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] bg-white">
                    {sortedAsst.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={`${td} text-center text-[#6B7280] py-8`}>
                          No assistant coaches assigned in your visible teams.
                        </td>
                      </tr>
                    ) : (
                      sortedAsst.map((row) => (
                        <tr key={`${row.teamId}-${row.userId}`}>
                          <td className={`${td} font-medium text-[#212529]`}>{row.teamName}</td>
                          <td className={td}>{displayCoachName(row)}</td>
                          <td className={`${td} text-[#6B7280]`}>{row.email?.trim() ? row.email : "—"}</td>
                          <td className={`${td} text-right`}>
                            <button
                              type="button"
                              className="text-sm font-medium text-[#3B82F6] hover:underline"
                              onClick={() => openEditAssistant(row)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite coach</DialogTitle>
            <DialogDescription>
              Choose the team and role. The invite code can be shared with the coach to join Braik.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {inviteError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{inviteError}</div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="inv-team">Team</Label>
              <select
                id="inv-team"
                value={inviteTeamId}
                onChange={(e) => setInviteTeamId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {teamsPicklist.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-role">Role type</Label>
              <select
                id="inv-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "head_coach" | "assistant_coach")}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="head_coach">Head coach</option>
                <option value="assistant_coach">Assistant coach</option>
              </select>
            </div>
            {inviteCode ? (
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-sm">
                <p className="font-medium text-[#212529]">Invite code</p>
                <p className="mt-1 font-mono text-[#1D4ED8]">{inviteCode}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Close
            </Button>
            {!inviteCode ? (
              <Button type="button" disabled={inviteBusy} onClick={() => void submitInvite()}>
                {inviteBusy ? "Creating…" : "Create invite"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editKind === "vacant" ? "Assign head coach" : "Edit coach assignment"}
            </DialogTitle>
            <DialogDescription>
              {editKind === "vacant"
                ? `Team: ${editTeamName}. Enter an existing Braik account email, or use Invite coach for a new signup code.`
                : `Team context: ${editTeamName}. Changes apply to team membership (not program-level roles).`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{editError}</div>
            ) : null}
            {editKind === "vacant" ? (
              <div className="space-y-2">
                <Label htmlFor="vac-email">Coach email (existing account)</Label>
                <Input
                  id="vac-email"
                  type="email"
                  value={editVacantEmail}
                  onChange={(e) => setEditVacantEmail(e.target.value)}
                  placeholder="coach@school.edu"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ed-name">Coach name</Label>
                  <Input
                    id="ed-name"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-team">Assigned team</Label>
                  <select
                    id="ed-team"
                    value={editTargetTeamId}
                    onChange={(e) => setEditTargetTeamId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {teamsPicklist.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-role">Role type</Label>
                  <select
                    id="ed-role"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as "head_coach" | "assistant_coach")}
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="head_coach">Head coach</option>
                    <option value="assistant_coach">Assistant coach</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={editBusy} onClick={() => void submitEdit()}>
              {editBusy ? "Saving…" : editKind === "vacant" ? "Assign" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
