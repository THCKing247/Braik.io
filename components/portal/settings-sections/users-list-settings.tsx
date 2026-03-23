"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, UserCheck, UserX, ChevronDown, ChevronUp } from "lucide-react"

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "outline" }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        variant === "outline"
          ? "border border-border bg-transparent text-foreground"
          : "bg-primary text-primary-foreground"
      }`}
    >
      {children}
    </span>
  )
}

interface User {
  id: string
  email: string
  name: string | null
  role: string
  coordinatorRole: string | null
  positionCoachRoles: string[]
  staffStatus?: "active" | "pending_assignment"
  playerRelation?: {
    playerId: string
    playerName: string
  }
}

interface UsersListSettingsProps {
  teamId: string
}

const COORDINATOR_ROLES = [
  { value: null, label: "None" },
  { value: "offensive_coordinator", label: "Offensive Coordinator" },
  { value: "defensive_coordinator", label: "Defensive Coordinator" },
  { value: "special_teams_coordinator", label: "Special Teams Coordinator" },
] as const

const POSITION_COACH_ROLES = {
  offense: ["OL", "WR", "QB", "RB", "TE"],
  defense: ["DB", "LB", "DL"],
  specialTeams: ["Snap", "Kick", "Punt"],
}

type CoachAssignmentRow = { assignmentType: string; userId: string; displayName: string | null }

export function UsersListSettings({ teamId }: UsersListSettingsProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [programId, setProgramId] = useState<string | null>(null)
  const [canEditProgramAssignments, setCanEditProgramAssignments] = useState(false)
  const [coachAssignments, setCoachAssignments] = useState<CoachAssignmentRow[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [teamId])

  const loadUsers = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/users`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
        setProgramId(data.programId ?? null)
        setCanEditProgramAssignments(Boolean(data.canEditProgramAssignments))
      }
    } catch (error) {
      console.error("Failed to load users:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadCoachAssignments = async (pid: string) => {
    setAssignmentsLoading(true)
    try {
      const res = await fetch(`/api/programs/${pid}/coach-assignments`)
      if (res.ok) {
        const data = await res.json()
        setCoachAssignments(data.assignments || [])
      }
    } catch (e) {
      console.error("Failed to load coach assignments", e)
    } finally {
      setAssignmentsLoading(false)
    }
  }

  useEffect(() => {
    if (programId && canEditProgramAssignments) {
      loadCoachAssignments(programId)
    } else {
      setCoachAssignments([])
    }
  }, [programId, canEditProgramAssignments, teamId])

  const toggleExpand = (userId: string) => {
    const newExpanded = new Set(expandedUsers)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedUsers(newExpanded)
  }

  const handleCoordinatorChange = async (userId: string, coordinatorRole: string | null) => {
    setSaving(userId)
    try {
      const res = await fetch(`/api/teams/${teamId}/users/${userId}/coaching-structure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinatorRole }),
      })

      if (res.ok) {
        await loadUsers()
      } else {
        const error = await res.json()
        alert(error.error || "Failed to update coordinator role")
      }
    } catch (error) {
      alert("Failed to update coordinator role")
    } finally {
      setSaving(null)
    }
  }

  const handleActivateStaff = async (userId: string) => {
    setSaving(userId)
    try {
      const res = await fetch(`/api/teams/${teamId}/users/${userId}/staff-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffStatus: "active" }),
      })
      if (res.ok) {
        await loadUsers()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Failed to activate coach")
      }
    } catch {
      alert("Failed to activate coach")
    } finally {
      setSaving(null)
    }
  }

  const handleProgramAssignmentChange = async (assignmentType: "jv_head" | "freshman_head", userId: string | null) => {
    if (!programId) return
    setSaving(`assign-${assignmentType}`)
    try {
      const res = await fetch(`/api/programs/${programId}/coach-assignments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentType, userId }),
      })
      if (res.ok) {
        await loadCoachAssignments(programId)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Failed to update assignment")
      }
    } catch {
      alert("Failed to update assignment")
    } finally {
      setSaving(null)
    }
  }

  const handlePositionCoachToggle = async (userId: string, positionRole: string, isAdding: boolean) => {
    setSaving(userId)
    try {
      const user = users.find((u) => u.id === userId)
      if (!user) return

      const currentRoles = user.positionCoachRoles || []
      const newRoles = isAdding
        ? [...currentRoles, positionRole]
        : currentRoles.filter((r) => r !== positionRole)

      const res = await fetch(`/api/teams/${teamId}/users/${userId}/coaching-structure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionCoachRoles: newRoles }),
      })

      if (res.ok) {
        await loadUsers()
      } else {
        const error = await res.json()
        alert(error.error || "Failed to update position coach roles")
      }
    } catch (error) {
      alert("Failed to update position coach roles")
    } finally {
      setSaving(null)
    }
  }

  const assistants = users.filter((u) => u.role === "assistant_coach" || u.role === "ASSISTANT_COACH")
  const players = users.filter((u) => u.role === "player" || u.role === "PLAYER")
  const parents = users.filter((u) => u.role === "parent" || u.role === "PARENT")

  const assignmentOptions = assistants.filter((u) => u.staffStatus !== "pending_assignment")
  const jvHeadId = coachAssignments.find((a) => a.assignmentType === "jv_head")?.userId ?? ""
  const frHeadId = coachAssignments.find((a) => a.assignmentType === "freshman_head")?.userId ?? ""

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Team Users
        </h2>
        <p className="text-sm mt-1 text-muted-foreground">
          Manage your team members and coaching structure
        </p>
      </div>

      {programId && canEditProgramAssignments && (
        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Football program leadership</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Assign JV and Freshman head coaches. Your account remains the Director of Football / Varsity head coach.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignmentsLoading ? (
              <p className="text-sm text-muted-foreground">Loading assignments…</p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">JV head coach</label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    value={jvHeadId || ""}
                    disabled={Boolean(saving)}
                    onChange={(e) =>
                      handleProgramAssignmentChange("jv_head", e.target.value || null)
                    }
                  >
                    <option value="">Unassigned</option>
                    {assignmentOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Freshman head coach</label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    value={frHeadId || ""}
                    disabled={Boolean(saving)}
                    onChange={(e) =>
                      handleProgramAssignmentChange("freshman_head", e.target.value || null)
                    }
                  >
                    <option value="">Unassigned</option>
                    {assignmentOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assistants Section */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <UserCheck className="h-5 w-5 text-primary" />
            Assistant Coaches ({assistants.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assistants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assistant coaches connected to this team.
            </p>
          ) : (
            assistants.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isExpanded={expandedUsers.has(user.id)}
                onToggleExpand={() => toggleExpand(user.id)}
                onCoordinatorChange={(role) => handleCoordinatorChange(user.id, role)}
                onPositionCoachToggle={(role, isAdding) => handlePositionCoachToggle(user.id, role, isAdding)}
                onActivateStaff={() => handleActivateStaff(user.id)}
                saving={saving === user.id}
                existingCoordinators={assistants
                  .filter((u) => u.id !== user.id && u.coordinatorRole)
                  .map((u) => u.coordinatorRole as string)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Players Section */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Players ({players.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No players connected to this team.
            </p>
          ) : (
            players.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {user.name || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <Badge variant="outline">Player</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Parents Section */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Parents ({parents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No parents connected to this team.
            </p>
          ) : (
            parents.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {user.name || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.email}
                    {user.playerRelation && ` • Parent of ${user.playerRelation.playerName}`}
                  </p>
                </div>
                <Badge variant="outline">Parent</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface UserCardProps {
  user: User
  isExpanded: boolean
  onToggleExpand: () => void
  onCoordinatorChange: (role: string | null) => void
  onPositionCoachToggle: (role: string, isAdding: boolean) => void
  onActivateStaff: () => void
  saving: boolean
  existingCoordinators: (string | null)[]
}

function UserCard({
  user,
  isExpanded,
  onToggleExpand,
  onCoordinatorChange,
  onPositionCoachToggle,
  onActivateStaff,
  saving,
  existingCoordinators,
}: UserCardProps) {
  const currentCoordinatorRole = user.coordinatorRole || null
  const currentPositionRoles = user.positionCoachRoles || []
  const isPending = user.staffStatus === "pending_assignment"
  const controlsDisabled = saving || isPending

  return (
    <div className="border border-border rounded-lg bg-card">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex-1">
          <p className="font-medium text-foreground">
            {user.name || "Unknown"}
          </p>
          <p className="text-xs text-muted-foreground">
            {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <Badge variant="outline">Pending assignment</Badge>
          )}
          {currentCoordinatorRole && (
            <Badge>
              {COORDINATOR_ROLES.find((r) => r.value === currentCoordinatorRole)?.label}
            </Badge>
          )}
          {currentPositionRoles.length > 0 && (
            <Badge variant="outline">
              {currentPositionRoles.length} Position{currentPositionRoles.length > 1 ? "s" : ""}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4 bg-card">
          {isPending && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-2">
              <p className="text-sm text-foreground">
                This coach linked with a team code but is not activated yet. Activate them to grant normal assistant permissions.
              </p>
              <Button type="button" size="sm" onClick={(e) => { e.stopPropagation(); onActivateStaff() }} disabled={saving}>
                Activate coach
              </Button>
            </div>
          )}
          {/* Coordinator Role */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Coordinator Role
            </label>
            <select
              value={currentCoordinatorRole || "none"}
              onChange={(e) => onCoordinatorChange(e.target.value === "none" ? null : e.target.value)}
              disabled={controlsDisabled}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              {COORDINATOR_ROLES.map((role) => {
                const isTaken = role.value ? existingCoordinators.includes(role.value) : false
                const isDisabled = isTaken && role.value !== currentCoordinatorRole
                return (
                  <option
                    key={role.value || "none"}
                    value={role.value || "none"}
                    disabled={isDisabled}
                  >
                    {role.label}
                    {isTaken && role.value !== currentCoordinatorRole && " (Assigned)"}
                  </option>
                )
              })}
            </select>
            <p className="text-xs text-muted-foreground">
              Only one person can hold each coordinator role.
            </p>
          </div>

          {/* Position Coach Roles */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">
              Position Coach Roles
            </label>
            <p className="text-xs text-muted-foreground">
              A coach can hold multiple position roles.
            </p>

            {/* Offense */}
            <div>
              <p className="text-xs font-medium mb-2 text-foreground">
                Offense
              </p>
              <div className="flex flex-wrap gap-2">
                {POSITION_COACH_ROLES.offense.map((role) => {
                  const isSelected = currentPositionRoles.includes(role)
                  return (
                    <Button
                      key={role}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPositionCoachToggle(role, !isSelected)}
                      disabled={controlsDisabled}
                      className={isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-foreground"}
                    >
                      {role}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Defense */}
            <div>
              <p className="text-xs font-medium mb-2 text-foreground">
                Defense
              </p>
              <div className="flex flex-wrap gap-2">
                {POSITION_COACH_ROLES.defense.map((role) => {
                  const isSelected = currentPositionRoles.includes(role)
                  return (
                    <Button
                      key={role}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPositionCoachToggle(role, !isSelected)}
                      disabled={controlsDisabled}
                      className={isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-foreground"}
                    >
                      {role}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Special Teams */}
            <div>
              <p className="text-xs font-medium mb-2 text-foreground">
                Special Teams
              </p>
              <div className="flex flex-wrap gap-2">
                {POSITION_COACH_ROLES.specialTeams.map((role) => {
                  const isSelected = currentPositionRoles.includes(role)
                  return (
                    <Button
                      key={role}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPositionCoachToggle(role, !isSelected)}
                      disabled={controlsDisabled}
                      className={isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-foreground"}
                    >
                      {role}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
