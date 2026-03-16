"use client"

import { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Printer, Edit, Search } from "lucide-react"
import { InventoryIcon } from "./inventory-icon"
import { EditItemModal } from "./edit-item-modal"

interface InventoryItem {
  id: string
  category: string
  name: string
  condition: string
  status: string
  assignedToPlayerId?: string | null
  equipmentType?: string | null
  size?: string | null
  make?: string | null
  itemCode?: string | null
  notes?: string | null
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
  onUpdateItem: (itemId: string, data: {
    condition: string
    status: string
    assignedToPlayerId?: string | null
    notes?: string
    size?: string
    make?: string
  }) => Promise<void>
  permissions: {
    canAssign: boolean
    canEdit: boolean
  }
  loading: boolean
  viewMode: "card" | "list"
  teamId: string
}

export function InventoryItemsModal({
  open,
  onClose,
  items,
  players,
  equipmentType,
  onAssignItem,
  onReturnItem,
  onUpdateItem,
  permissions,
  loading,
  viewMode,
  teamId,
}: InventoryItemsModalProps) {
  // Add hover effect styles for inventory icons
  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = `
      .inventory-card:hover .inventory-icon img {
        opacity: 1;
      }
    `
    style.setAttribute("data-inventory-icons", "true")
    if (!document.head.querySelector("style[data-inventory-icons]")) {
      document.head.appendChild(style)
    }
    return () => {
      const existingStyle = document.head.querySelector("style[data-inventory-icons]")
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }
    }
  }, [])
  
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null)
  const [returningItemId, setReturningItemId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

  // Filter items based on search query (equipment code or player name)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items

    const query = searchQuery.toLowerCase().trim()
    return items.filter((item) => {
      // Search by item code
      if (item.itemCode?.toLowerCase().includes(query)) return true
      
      // Search by player name
      if (item.assignedPlayer) {
        const playerName = `${item.assignedPlayer.firstName} ${item.assignedPlayer.lastName}`.toLowerCase()
        if (playerName.includes(query)) return true
        if (item.assignedPlayer.jerseyNumber?.toString().includes(query)) return true
      }
      
      // Search by item name
      if (item.name.toLowerCase().includes(query)) return true
      
      return false
    })
  }, [items, searchQuery])

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

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
  }

  const handleSaveEdit = async (data: {
    condition: string
    status: string
    assignedToPlayerId?: string | null
    notes?: string
    size?: string
    make?: string
  }) => {
    if (!editingItem) return
    await onUpdateItem(editingItem.id, data)
    setEditingItem(null)
  }

  const handlePrintLabel = (item: InventoryItem) => {
    if (!item.itemCode) {
      alert("No item code available for this item")
      return
    }

    // Create a print window with the label
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Please allow popups to print labels")
      return
    }

    const labelHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Equipment Label - ${item.itemCode}</title>
          <style>
            @media print {
              @page {
                size: 2in 1in;
                margin: 0.1in;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 2in;
              height: 1in;
              border: 2px solid #000;
              padding: 0.1in;
              box-sizing: border-box;
            }
            .code {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .name {
              font-size: 12px;
              text-align: center;
            }
            .type {
              font-size: 10px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="code">${item.itemCode}</div>
          <div class="name">${item.name}</div>
          <div class="type">${item.equipmentType || item.category}</div>
        </body>
      </html>
    `

    printWindow.document.write(labelHTML)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const canPrint = (equipmentType: string | null | undefined) => {
    if (!equipmentType) return false
    const type = equipmentType.toLowerCase()
    return !type.includes("mouthpiece") && !type.includes("knee pad") && !type.includes("chinstrap")
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
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: "rgb(var(--border))" }}>
              <DialogHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <InventoryIcon type={equipmentType} size={28} />
                    <DialogTitle>{equipmentType} - All Items ({filteredItems.length})</DialogTitle>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-[rgb(var(--platinum))] transition-colors"
                    style={{ color: "rgb(var(--muted))" }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: "rgb(var(--muted))" }} />
                  <Input
                    type="text"
                    placeholder="Search by equipment code or player name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "rgb(var(--border))",
                      color: "rgb(var(--text))",
                    }}
                  />
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
              {viewMode === "card" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => {
                    const jerseyLabel = getJerseyLabel(item.equipmentType, item.name)
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-lg border bg-white hover:shadow-md transition-shadow cursor-pointer"
                        style={{ borderColor: "rgb(var(--border))" }}
                        onClick={() => permissions.canEdit && handleEdit(item)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                              <InventoryIcon
                                type={item.equipmentType || item.category}
                              />
                              {jerseyLabel && (
                                <span className="absolute -top-1 -right-1 text-xs font-bold bg-[rgb(var(--accent))] text-white rounded-full w-5 h-5 flex items-center justify-center">
                                  {jerseyLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm mb-1 truncate" style={{ color: "rgb(var(--text))" }}>
                                {item.name}
                              </p>
                              {item.itemCode && (
                                <p className="text-xs mb-1 font-mono" style={{ color: "rgb(var(--muted))" }}>
                                  Code: {item.itemCode}
                                </p>
                              )}
                              {(item.size || item.make) && (
                                <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>
                                  {item.size && `Size: ${item.size}`}
                                  {item.size && item.make && " • "}
                                  {item.make && `Make: ${item.make}`}
                                </p>
                              )}
                            </div>
                          </div>
                          {permissions.canEdit && (
                            <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                              {canPrint(item.equipmentType) && (
                                <button
                                  onClick={() => handlePrintLabel(item)}
                                  className="p-1 rounded hover:bg-[rgb(var(--platinum))] transition-colors"
                                  style={{ color: "rgb(var(--accent))" }}
                                  title="Print Label"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-1 rounded hover:bg-[rgb(var(--platinum))] transition-colors"
                                style={{ color: "rgb(var(--accent))" }}
                                title="Edit Item"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
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
                        {permissions.canAssign && (
                          <div className="space-y-2 pt-3 border-t" style={{ borderTopColor: "rgb(var(--border))" }} onClick={(e) => e.stopPropagation()}>
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
                  {filteredItems.map((item) => {
                    const jerseyLabel = getJerseyLabel(item.equipmentType, item.name)
                    return (
                      <div
                        key={item.id}
                        className="inventory-card p-3 rounded-lg border bg-white cursor-pointer hover:bg-[rgb(var(--platinum))] transition-colors"
                        style={{ borderColor: "rgb(var(--border))" }}
                        onClick={() => permissions.canEdit && handleEdit(item)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                              <InventoryIcon
                                type={item.equipmentType || item.category}
                              />
                              {jerseyLabel && (
                                <span className="absolute -top-1 -right-1 text-xs font-bold bg-[rgb(var(--accent))] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                  {jerseyLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate" style={{ color: "rgb(var(--text))" }}>
                                {item.name}
                              </p>
                              {item.itemCode && (
                                <p className="text-xs font-mono" style={{ color: "rgb(var(--muted))" }}>
                                  Code: {item.itemCode}
                                </p>
                              )}
                              {(item.size || item.make) && (
                                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                                  {item.size && `Size: ${item.size}`}
                                  {item.size && item.make && " • "}
                                  {item.make && `Make: ${item.make}`}
                                </p>
                              )}
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
                          <div className="ml-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {permissions.canEdit && (
                              <>
                                {canPrint(item.equipmentType) && (
                                  <button
                                    onClick={() => handlePrintLabel(item)}
                                    className="p-1 rounded hover:bg-[rgb(var(--platinum))] transition-colors"
                                    style={{ color: "rgb(var(--accent))" }}
                                    title="Print Label"
                                  >
                                    <Printer className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-1 rounded hover:bg-[rgb(var(--platinum))] transition-colors"
                                  style={{ color: "rgb(var(--accent))" }}
                                  title="Edit Item"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {permissions.canAssign && (
                              <>
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
                              </>
                            )}
                          </div>
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

      {/* Edit Item Modal */}
      {editingItem && (
        <EditItemModal
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          players={players}
          onSave={handleSaveEdit}
          loading={loading}
        />
      )}
    </>
  )
}
