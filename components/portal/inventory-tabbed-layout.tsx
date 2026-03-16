"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Edit, Trash2, Printer, MoreVertical, Search, LayoutGrid, List } from "lucide-react"
import { InventoryIcon } from "./inventory-icon"
import { EditItemModal } from "./edit-item-modal"
import { AddItemModal } from "./add-item-modal"
import { BulkEditModal } from "./bulk-edit-modal"

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

interface InventoryTabbedLayoutProps {
  items: InventoryItem[]
  players: Player[]
  teamId: string
  permissions: {
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canAssign: boolean
    canViewAll: boolean
    scopedPlayerIds: string[] | null
  }
  onAddItem: (data: {
    equipmentType: string
    customEquipmentName?: string
    quantity: number
    condition: string
    availability: string
    assignedToPlayerId?: string | null
    notes?: string
  }) => Promise<void>
  onUpdateItem: (itemId: string, data: {
    condition: string
    status: string
    assignedToPlayerId?: string | null
    notes?: string
    size?: string
    make?: string
  }) => Promise<void>
  onUpdateAllItems: (equipmentType: string, data: {
    condition?: string
    status?: string
    notes?: string
  }) => Promise<void>
  onAssignItem: (itemId: string, playerId: string | null) => Promise<void>
  onReturnItem: (itemId: string) => Promise<void>
  onDeleteGroup: (equipmentType: string) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
  loading: boolean
}

export function InventoryTabbedLayout({
  items,
  players,
  teamId,
  permissions,
  onAddItem,
  onUpdateItem,
  onUpdateAllItems,
  onAssignItem,
  onReturnItem,
  onDeleteGroup,
  onDeleteItem,
  loading,
}: InventoryTabbedLayoutProps) {
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
  
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null)
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null)
  const [returningItemId, setReturningItemId] = useState<string | null>(null)

  // Group items by equipment type
  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      const key = item.equipmentType || item.category || "UNKNOWN"
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(item)
      return acc
    }, {} as Record<string, InventoryItem[]>)
  }, [items])

  const equipmentTypes = Object.keys(groupedItems).sort()

  // Set first tab as active if none selected
  useMemo(() => {
    if (!activeTab && equipmentTypes.length > 0) {
      setActiveTab(equipmentTypes[0])
    }
  }, [activeTab, equipmentTypes])

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!activeTab) return []
    const tabItems = groupedItems[activeTab] || []
    if (!searchQuery.trim()) return tabItems

    const query = searchQuery.toLowerCase().trim()
    return tabItems.filter((item) => {
      if (item.itemCode?.toLowerCase().includes(query)) return true
      if (item.assignedPlayer) {
        const playerName = `${item.assignedPlayer.firstName} ${item.assignedPlayer.lastName}`.toLowerCase()
        if (playerName.includes(query)) return true
        if (item.assignedPlayer.jerseyNumber?.toString().includes(query)) return true
      }
      if (item.name.toLowerCase().includes(query)) return true
      if (item.size?.toLowerCase().includes(query)) return true
      if (item.make?.toLowerCase().includes(query)) return true
      return false
    })
  }, [activeTab, groupedItems, searchQuery])

  // Calculate stats for active tab
  const tabStats = useMemo(() => {
    if (!activeTab) return { total: 0, available: 0, assigned: 0, needsAttention: 0 }
    const tabItems = groupedItems[activeTab] || []
    return {
      total: tabItems.length,
      available: tabItems.filter(i => !i.assignedToPlayerId && i.status === "AVAILABLE").length,
      assigned: tabItems.filter(i => i.assignedToPlayerId).length,
      needsAttention: tabItems.filter(i => 
        i.status === "NEEDS_REPAIR" || 
        i.status === "DAMAGED" || 
        i.status === "MISSING" ||
        i.condition === "NEEDS_REPAIR" ||
        i.condition === "REPLACE"
      ).length,
    }
  }, [activeTab, groupedItems])

  const handleBulkEdit = () => {
    if (!activeTab) return
    setShowBulkEditModal(true)
  }

  const handleBulkPrint = () => {
    if (!activeTab) return
    const tabItems = groupedItems[activeTab] || []
    const itemsWithCodes = tabItems.filter(item => item.itemCode)
    
    if (itemsWithCodes.length === 0) {
      alert("No items with codes available to print")
      return
    }

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Please allow popups to print labels")
      return
    }

    const labelHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Equipment Labels - ${activeTab}</title>
          <style>
            @media print {
              @page {
                size: letter;
                margin: 0.5in;
              }
            }
            body {
              font-family: Arial, sans-serif;
              display: grid;
              grid-template-columns: repeat(3, 2in);
              gap: 0.2in;
              padding: 0.2in;
            }
            .label {
              border: 2px solid #000;
              padding: 0.1in;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 1in;
              box-sizing: border-box;
            }
            .code {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .name {
              font-size: 10px;
              text-align: center;
            }
            .type {
              font-size: 8px;
              color: #666;
            }
          </style>
        </head>
        <body>
          ${itemsWithCodes.map(item => `
            <div class="label">
              <div class="code">${item.itemCode}</div>
              <div class="name">${item.name}</div>
              <div class="type">${item.equipmentType || item.category}</div>
            </div>
          `).join('')}
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

  const handleBulkDelete = () => {
    if (!activeTab) return
    const tabItems = groupedItems[activeTab] || []
    if (!confirm(`Are you sure you want to delete all ${tabItems.length} items of type "${activeTab}"?`)) return
    onDeleteGroup(activeTab)
    setShowMenuFor(null)
  }

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
      return { backgroundColor: "#f0f9ff", color: "#0369a1", borderColor: "#bae6fd" }
    }
    if (status === "ASSIGNED") {
      return { backgroundColor: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }
    }
    if (status === "NEEDS_REPAIR") {
      return { backgroundColor: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }
    }
    return { backgroundColor: "#f3f4f6", color: "#374151", borderColor: "#d1d5db" }
  }

  const getConditionColor = (condition: string) => {
    if (condition === "EXCELLENT") return { color: "#059669" }
    if (condition === "GOOD") return { color: "#0d9488" }
    if (condition === "FAIR") return { color: "#d97706" }
    if (condition === "POOR") return { color: "#dc2626" }
    if (condition === "NEEDS_REPAIR") return { color: "#991b1b" }
    return { color: "rgb(var(--text))" }
  }

  if (equipmentTypes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No equipment items yet</p>
        {permissions.canCreate && (
          <Button
            onClick={() => setShowAddModal(true)}
            style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
          >
            Add Your First Equipment
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Sidebar - Tabs */}
      <div className="w-64 flex-shrink-0 border-r" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="p-4 border-b" style={{ borderColor: "rgb(var(--border))" }}>
          <h3 className="font-semibold mb-2" style={{ color: "rgb(var(--text))" }}>Equipment Types</h3>
          {permissions.canCreate && (
            <Button
              onClick={() => setShowAddModal(true)}
              className="w-full"
              style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
              size="sm"
            >
              + Add Equipment
            </Button>
          )}
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {equipmentTypes.map((equipmentType) => {
            const typeItems = groupedItems[equipmentType] || []
            const isActive = activeTab === equipmentType
            return (
              <div
                key={equipmentType}
                className={`p-3 border-b cursor-pointer transition-colors relative ${
                  isActive ? "bg-[rgb(var(--platinum))]" : "hover:bg-[rgb(var(--platinum))]"
                }`}
                style={{ borderColor: "rgb(var(--border))" }}
                onClick={() => setActiveTab(equipmentType)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <InventoryIcon type={equipmentType} size={20} />
                    <span className="font-medium text-sm truncate" style={{ color: "rgb(var(--text))" }}>
                      {equipmentType}
                    </span>
                    <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                      ({typeItems.length})
                    </span>
                  </div>
                  {permissions.canEdit && (
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setShowMenuFor(showMenuFor === equipmentType ? null : equipmentType)}
                        className="p-1 rounded hover:bg-white transition-colors"
                        style={{ color: "rgb(var(--muted))" }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {showMenuFor === equipmentType && (
                        <div className="absolute right-0 top-8 z-50 bg-white border rounded-md shadow-lg min-w-[120px]" style={{ borderColor: "rgb(var(--border))" }}>
                          <button
                            onClick={() => {
                              handleBulkEdit()
                              setShowMenuFor(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[rgb(var(--platinum))] flex items-center gap-2"
                            style={{ color: "rgb(var(--text))" }}
                          >
                            <Edit className="h-4 w-4" />
                            Edit All
                          </button>
                          <button
                            onClick={() => {
                              handleBulkPrint()
                              setShowMenuFor(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[rgb(var(--platinum))] flex items-center gap-2"
                            style={{ color: "rgb(var(--text))" }}
                          >
                            <Printer className="h-4 w-4" />
                            Print Codes
                          </button>
                          {permissions.canDelete && (
                            <button
                              onClick={() => {
                                handleBulkDelete()
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2"
                              style={{ color: "#dc2626" }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete All
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {activeTab && (
          <>
            {/* Stats and Controls */}
            <div className="border-b p-4" style={{ borderColor: "rgb(var(--border))" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <InventoryIcon type={activeTab} size={24} />
                  <h2 className="text-xl font-semibold" style={{ color: "rgb(var(--text))" }}>
                    {activeTab}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 border rounded-lg p-1" style={{ borderColor: "rgb(var(--border))" }}>
                    <button
                      type="button"
                      onClick={() => setViewMode("card")}
                      className={`p-2 rounded transition-colors ${
                        viewMode === "card"
                          ? "bg-[rgb(var(--accent))] text-white"
                          : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--platinum))]"
                      }`}
                      title="Card view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded transition-colors ${
                        viewMode === "list"
                          ? "bg-[rgb(var(--accent))] text-white"
                          : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--platinum))]"
                      }`}
                      title="List view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded border bg-white" style={{ borderColor: "rgb(var(--border))" }}>
                  <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Total Items</p>
                  <p className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>{tabStats.total}</p>
                </div>
                <div className="p-3 rounded border bg-white" style={{ borderColor: "rgb(var(--border))" }}>
                  <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Available</p>
                  <p className="text-2xl font-bold" style={{ color: "#059669" }}>{tabStats.available}</p>
                </div>
                <div className="p-3 rounded border bg-white" style={{ borderColor: "rgb(var(--border))" }}>
                  <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Assigned</p>
                  <p className="text-2xl font-bold" style={{ color: "#d97706" }}>{tabStats.assigned}</p>
                </div>
                <div className="p-3 rounded border bg-white" style={{ borderColor: "rgb(var(--border))" }}>
                  <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Needs Attention</p>
                  <p className="text-2xl font-bold" style={{ color: "#dc2626" }}>{tabStats.needsAttention}</p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: "rgb(var(--muted))" }} />
                <Input
                  type="text"
                  placeholder="Search by code, player name, size, or make..."
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
            </div>

            {/* Items Display */}
            <div className="flex-1 overflow-y-auto p-4 inventory-modal-scroll" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {searchQuery ? "No items match your search" : "No items in this category"}
                  </p>
                </div>
              ) : viewMode === "card" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => {
                    const jerseyLabel = getJerseyLabel(item.equipmentType, item.name)
                    return (
                      <Card
                        key={item.id}
                        className="border hover:shadow-md transition-shadow cursor-pointer"
                        style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
                        onClick={() => setEditingItem(item)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="relative flex-shrink-0">
                              <InventoryIcon
                                type={item.equipmentType || item.category}
                                size={28}
                              />
                              {jerseyLabel && (
                                <span className="absolute -top-1 -right-1 text-xs font-bold bg-[rgb(var(--accent))] text-white rounded-full w-5 h-5 flex items-center justify-center">
                                  {jerseyLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm mb-1" style={{ color: "rgb(var(--text))" }}>
                                {item.name}
                              </p>
                              {item.itemCode && (
                                <p className="text-xs font-mono mb-1" style={{ color: "rgb(var(--muted))" }}>
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
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map((item) => {
                    const jerseyLabel = getJerseyLabel(item.equipmentType, item.name)
                    return (
                      <Card
                        key={item.id}
                        className="inventory-card border cursor-pointer hover:bg-[rgb(var(--platinum))] transition-colors"
                        style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
                        onClick={() => setEditingItem(item)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="relative flex-shrink-0">
                                <InventoryIcon
                                  type={item.equipmentType || item.category}
                                  size={28}
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
                            {permissions.canAssign && (
                              <div className="ml-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {permissions.canCreate && (
        <AddItemModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={onAddItem}
          players={players}
          loading={loading}
        />
      )}

      {editingItem && (
        <EditItemModal
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          players={players}
          onSave={async (data) => {
            await onUpdateItem(editingItem.id, data)
            setEditingItem(null)
          }}
          loading={loading}
        />
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && activeTab && (
        <BulkEditModal
          open={showBulkEditModal}
          onClose={() => setShowBulkEditModal(false)}
          type={activeTab}
          itemCount={groupedItems[activeTab]?.length || 0}
          onSave={async (data) => {
            await onUpdateAllItems(activeTab, data)
            setShowBulkEditModal(false)
          }}
          loading={loading}
        />
      )}
    </div>
  )
}
