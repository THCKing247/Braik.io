"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, UserCheck, UserX, ChevronDown, ChevronUp } from "lucide-react"

// Badge component - simple inline implementation
function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "outline" }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        variant === "outline" ? "border" : ""
      }`}
      style={
        variant === "outline"
          ? {
              borderColor: "rgb(var(--border))",
              color: "rgb(var(--text))",
              backgroundColor: "transparent",
            }
          : {
              backgroundColor: "rgb(var(--accent))",
              color: "white",
            }
      }
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

export function UsersListSettings({ teamId }: UsersListSettingsProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [teamId])

  const loadUsers = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/users`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error("Failed to load users:", error)
    } finally {
      setLoading(false)
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>
          Team Users
        </h2>
        <p className="text-sm mt-1" style={{ color: "rgb(var(--muted))" }}>
          Manage your team members and coaching structure
        </p>
      </div>

      {/* Assistants Section */}
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
            <UserCheck className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
            Assistant Coaches ({assistants.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assistants.length === 0 ? (
            <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
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
                saving={saving === user.id}
                existingCoordinators={assistants
                  .filter((u) => u.id !== user.id && u.coordinatorRole)
                  .map((u) => u.coordinatorRole)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Players Section */}
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
            <Users className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
            Players ({players.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {players.length === 0 ? (
            <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
              No players connected to this team.
            </p>
          ) : (
            players.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "rgb(var(--border))" }}
              >
                <div>
                  <p className="font-medium" style={{ color: "rgb(var(--text))" }}>
                    {user.name || "Unknown"}
                  </p>
                  <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
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
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
            <Users className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
            Parents ({parents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {parents.length === 0 ? (
            <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
              No parents connected to this team.
            </p>
          ) : (
            parents.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "rgb(var(--border))" }}
              >
                <div>
                  <p className="font-medium" style={{ color: "rgb(var(--text))" }}>
                    {user.name || "Unknown"}
                  </p>
                  <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
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
  saving: boolean
  existingCoordinators: (string | null)[]
}

function UserCard({
  user,
  isExpanded,
  onToggleExpand,
  onCoordinatorChange,
  onPositionCoachToggle,
  saving,
  existingCoordinators,
}: UserCardProps) {
  const currentCoordinatorRole = user.coordinatorRole || null
  const currentPositionRoles = user.positionCoachRoles || []

  return (
    <div className="border rounded-lg" style={{ borderColor: "rgb(var(--border))" }}>
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[rgb(var(--platinum))] transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex-1">
          <p className="font-medium" style={{ color: "rgb(var(--text))" }}>
            {user.name || "Unknown"}
          </p>
          <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
            {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentCoordinatorRole && (
            <Badge style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}>
              {COORDINATOR_ROLES.find((r) => r.value === currentCoordinatorRole)?.label}
            </Badge>
          )}
          {currentPositionRoles.length > 0 && (
            <Badge variant="outline">
              {currentPositionRoles.length} Position{currentPositionRoles.length > 1 ? "s" : ""}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" style={{ color: "rgb(var(--muted))" }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: "rgb(var(--muted))" }} />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t space-y-4" style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--platinum))" }}>
          {/* Coordinator Role */}
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
              Coordinator Role
            </label>
            <select
              value={currentCoordinatorRole || "none"}
              onChange={(e) => onCoordinatorChange(e.target.value === "none" ? null : e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 border rounded-md"
              style={{
                color: "rgb(var(--text))",
                borderColor: "rgb(var(--border))",
                backgroundColor: "#FFFFFF",
              }}
            >
              {COORDINATOR_ROLES.map((role) => {
                const isTaken = role.value && existingCoordinators.includes(role.value)
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
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              Only one person can hold each coordinator role.
            </p>
          </div>

          {/* Position Coach Roles */}
          <div className="space-y-3">
            <label className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
              Position Coach Roles
            </label>
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              A coach can hold multiple position roles.
            </p>

            {/* Offense */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "rgb(var(--text))" }}>
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
                      disabled={saving}
                      style={
                        isSelected
                          ? { backgroundColor: "rgb(var(--accent))", color: "white" }
                          : undefined
                      }
                    >
                      {role}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Defense */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "rgb(var(--text))" }}>
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
                      disabled={saving}
                      style={
                        isSelected
                          ? { backgroundColor: "rgb(var(--accent))", color: "white" }
                          : undefined
                      }
                    >
                      {role}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Special Teams */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "rgb(var(--text))" }}>
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
                      disabled={saving}
                      style={
                        isSelected
                          ? { backgroundColor: "rgb(var(--accent))", color: "white" }
                          : undefined
                      }
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
