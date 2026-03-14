"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { EquipmentIcon } from "./inventory-equipment-icons"

interface InventoryItem {
  id: string
  category: string
  name: string
  condition: string
  status: string
  assignedToPlayerId?: string | null
  equipmentType?: string | null
  assignedPlayer?: {
    id: string
    firstName: string
    lastName: string
    jerseyNumber?: number | null
  } | null
}

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber?: number | null
}

interface InventoryItemsModalProps {
  open: boolean
  onClose: () => void
  items: InventoryItem[]
  players: Player[]
  equipmentType: string
  onAssignItem: (itemId: string, playerId: string | null) => Promise<void>
  onReturnItem: (itemId: string) => Promise<void>
  permissions: {
    canAssign: boolean
  }
  loading: boolean
  viewMode: "card" | "list"
}

export function InventoryItemsModal({
  open,
  onClose,
  items,
  players,
  equipmentType,
  onAssignItem,
  onReturnItem,
  permissions,
  loading,
  viewMode,
}: InventoryItemsModalProps) {
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null)
  const [returningItemId, setReturningItemId] = useState<string | null>(null)

  const handleAssign = async (itemId: string, playerId: string | null) => {
    setAssigningItemId(itemId)
    try {
      await onAssignItem(itemId, playerId)
    } finally {
      setAssigningItemId(null)
    }
  }

  const handleReturn = async (itemId: string) => {
    setReturningItemId(itemId)
    try {
      await onReturnItem(itemId)
    } finally {
      setReturningItemId(null)
    }
  }

  const getJerseyLabel = (equipmentType: string | null | undefined, name?: string): string | null => {
    const type = (equipmentType || name || "").toLowerCase()
    if (type.includes("practice") && type.includes("jersey")) return "P"
    if (type.includes("home") && type.includes("jersey")) return "H"
    if (type.includes("away") && type.includes("jersey")) return "A"
    if (type.includes("alternate") && type.includes("jersey")) return "T"
    return null
  }

  const getStatusColor = (status: string) => {
    if (status === "AVAILABLE") {
      return {
        backgroundColor: "#f0f9ff",
        color: "#0369a1",
        borderColor: "#bae6fd",
      }
    }
    if (status === "ASSIGNED") {
      return {
        backgroundColor: "#fef3c7",
        color: "#92400e",
        borderColor: "#fde68a",
      }
    }
    if (status === "NEEDS_REPAIR") {
      return {
        backgroundColor: "#fee2e2",
        color: "#991b1b",
        borderColor: "#fecaca",
      }
    }
    return {
      backgroundColor: "#f3f4f6",
      color: "#374151",
      borderColor: "#d1d5db",
    }
  }

  const getConditionColor = (condition: string) => {
    if (condition === "EXCELLENT") {
      return { color: "#059669" }
    }
    if (condition === "GOOD") {
      return { color: "#0d9488" }
    }
    if (condition === "FAIR") {
      return { color: "#d97706" }
    }
    if (condition === "POOR") {
      return { color: "#dc2626" }
    }
    if (condition === "NEEDS_REPAIR") {
      return { color: "#991b1b" }
    }
    return { color: "rgb(var(--text))" }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: "rgb(var(--border))" }}>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <EquipmentIcon equipmentType={equipmentType} size={32} />
                  <DialogTitle>{equipmentType} - All Items ({items.length})</DialogTitle>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded hover:bg-[rgb(var(--platinum))] transition-colors"
                  style={{ color: "rgb(var(--muted))" }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div
            className="flex-1 overflow-y-auto px-6 py-4 inventory-modal-scroll"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {viewMode === "card" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const jerseyLabel = getJerseyLabel(item.equipmentType, item.name)
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border bg-white hover:shadow-md transition-shadow"
                      style={{ borderColor: "rgb(var(--border))" }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="relative flex-shrink-0">
                          <EquipmentIcon
                            equipmentType={item.equipmentType}
                            category={item.category}
                            size={40}
                          />
                          {jerseyLabel && (
                            <span className="absolute -top-1 -right-1 text-xs font-bold bg-[rgb(var(--accent))] text-white rounded-full w-5 h-5 flex items-center justify-center">
                              {jerseyLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm mb-2" style={{ color: "rgb(var(--text))" }}>
                            {item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span
                              className="text-xs px-2 py-1 rounded border"
                              style={getStatusColor(item.status)}
                            >
                              {item.status.replace("_", " ")}
                            </span>
                            <span className="text-xs font-medium" style={getConditionColor(item.condition)}>
                              {item.condition.replace("_", " ")}
                            </span>
                          </div>
                          {item.assignedPlayer && (
                            <p className="text-xs mb-2" style={{ color: "rgb(var(--muted))" }}>
                              Assigned to: {item.assignedPlayer.firstName} {item.assignedPlayer.lastName}
                              {item.assignedPlayer.jerseyNumber ? ` (#${item.assignedPlayer.jerseyNumber})` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      {permissions.canAssign && (
                        <div className="space-y-2 pt-3 border-t" style={{ borderTopColor: "rgb(var(--border))" }}>
                          {item.assignedToPlayerId ? (
                            <div className="space-y-2">
                              <select
                                value={item.assignedToPlayerId}
                                onChange={(e) => handleAssign(item.id, e.target.value || null)}
                                className="w-full px-3 py-2 text-sm border rounded-md"
                                style={{
                                  backgroundColor: "#FFFFFF",
                                  borderColor: "rgb(var(--border))",
                                  color: "rgb(var(--text))",
                                }}
                                disabled={loading || assigningItemId === item.id || returningItemId === item.id}
                              >
                                <option value={item.assignedToPlayerId}>
                                  {item.assignedPlayer?.firstName} {item.assignedPlayer?.lastName}
                                  {item.assignedPlayer?.jerseyNumber ? ` (#${item.assignedPlayer.jerseyNumber})` : ""}
                                </option>
                                {players.map((player) => (
                                  <option key={player.id} value={player.id}>
                                    {player.firstName} {player.lastName}
                                    {player.jerseyNumber ? ` (#${player.jerseyNumber})` : ""}
                                  </option>
                                ))}
                              </select>
                              <Button
                                onClick={() => handleReturn(item.id)}
                                disabled={loading || returningItemId === item.id || assigningItemId === item.id}
                                className="w-full"
                                style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                                size="sm"
                              >
                                {returningItemId === item.id ? "Returning..." : "Returned"}
                              </Button>
                            </div>
                          ) : (
                            <select
                              value=""
                              onChange={(e) => handleAssign(item.id, e.target.value || null)}
                              className="w-full px-3 py-2 text-sm border rounded-md"
                              style={{
                                backgroundColor: "#FFFFFF",
                                borderColor: "rgb(var(--border))",
                                color: "rgb(var(--text))",
                              }}
                              disabled={loading || assigningItemId === item.id}
                            >
                              <option value="">Assign to Player</option>
                              {players.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.firstName} {player.lastName}
                                  {player.jerseyNumber ? ` (#${player.jerseyNumber})` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const jerseyLabel = getJerseyLabel(item.equipmentType, item.name)
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border bg-white"
                      style={{ borderColor: "rgb(var(--border))" }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="relative flex-shrink-0">
                            <EquipmentIcon
                              equipmentType={item.equipmentType}
                              category={item.category}
                              size={32}
                            />
                            {jerseyLabel && (
                              <span className="absolute -top-1 -right-1 text-xs font-bold bg-[rgb(var(--accent))] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                {jerseyLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium" style={{ color: "rgb(var(--text))" }}>
                              {item.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span
                                className="text-xs px-2 py-1 rounded border"
                                style={getStatusColor(item.status)}
                              >
                                {item.status.replace("_", " ")}
                              </span>
                              <span className="text-xs" style={getConditionColor(item.condition)}>
                                {item.condition.replace("_", " ")}
                              </span>
                              {item.assignedPlayer && (
                                <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                                  Assigned to: {item.assignedPlayer.firstName} {item.assignedPlayer.lastName}
                                  {item.assignedPlayer.jerseyNumber ? ` (#${item.assignedPlayer.jerseyNumber})` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {permissions.canAssign && (
                          <div className="ml-4 flex items-center gap-2">
                            {item.assignedToPlayerId ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={item.assignedToPlayerId}
                                  onChange={(e) => handleAssign(item.id, e.target.value || null)}
                                  className="px-3 py-1.5 text-sm border rounded-md"
                                  style={{
                                    backgroundColor: "#FFFFFF",
                                    borderColor: "rgb(var(--border))",
                                    color: "rgb(var(--text))",
                                  }}
                                  disabled={loading || assigningItemId === item.id || returningItemId === item.id}
                                >
                                  <option value={item.assignedToPlayerId}>
                                    {item.assignedPlayer?.firstName} {item.assignedPlayer?.lastName}
                                    {item.assignedPlayer?.jerseyNumber ? ` (#${item.assignedPlayer.jerseyNumber})` : ""}
                                  </option>
                                  {players.map((player) => (
                                    <option key={player.id} value={player.id}>
                                      {player.firstName} {player.lastName}
                                      {player.jerseyNumber ? ` (#${player.jerseyNumber})` : ""}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  onClick={() => handleReturn(item.id)}
                                  disabled={loading || returningItemId === item.id || assigningItemId === item.id}
                                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                                  size="sm"
                                >
                                  {returningItemId === item.id ? "Returning..." : "Returned"}
                                </Button>
                              </div>
                            ) : (
                              <select
                                value=""
                                onChange={(e) => handleAssign(item.id, e.target.value || null)}
                                className="px-3 py-1.5 text-sm border rounded-md"
                                style={{
                                  backgroundColor: "#FFFFFF",
                                  borderColor: "rgb(var(--border))",
                                  color: "rgb(var(--text))",
                                }}
                                disabled={loading || assigningItemId === item.id}
                              >
                                <option value="">Assign to Player</option>
                                {players.map((player) => (
                                  <option key={player.id} value={player.id}>
                                    {player.firstName} {player.lastName}
                                    {player.jerseyNumber ? ` (#${player.jerseyNumber})` : ""}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
