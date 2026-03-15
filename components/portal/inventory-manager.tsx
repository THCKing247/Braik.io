"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, Package, ChevronDown, ChevronUp, Folder, LayoutGrid, List, Printer } from "lucide-react"
import { AddItemModal } from "./add-item-modal"
import { EquipmentIcon } from "./inventory-equipment-icons"
import { InventoryItemsModal } from "./inventory-items-modal"

interface InventoryItem {
  id: string
  category: string
  name: string
  quantityTotal: number
  quantityAvailable: number
  condition: string
  assignedToPlayerId?: string | null
  notes?: string | null
  status: string
  equipmentType?: string | null
  size?: string | null
  make?: string | null
  itemCode?: string | null
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

interface InventoryPermissions {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canAssign: boolean
  canViewAll: boolean
  scopedPlayerIds: string[] | null
}

interface InventoryManagerProps {
  teamId: string
  initialItems: InventoryItem[]
  players: Player[]
  permissions: InventoryPermissions
}

export function InventoryManager({
  teamId,
  initialItems,
  players,
  permissions,
}: InventoryManagerProps) {
  const [items, setItems] = useState(initialItems)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false) // For editing only
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [editingGroup, setEditingGroup] = useState<string | null>(null) // equipmentType being edited
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"card" | "list">("list")
  const [itemsModalOpen, setItemsModalOpen] = useState(false)
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    category: "",
    name: "",
    quantityTotal: "",
    quantityAvailable: "",
    condition: "GOOD",
    assignedToPlayerId: "",
    notes: "",
    status: "AVAILABLE",
  })
  const [files, setFiles] = useState<File[]>([])

  const resetForm = () => {
    setFormData({
      category: "",
      name: "",
      quantityTotal: "",
      quantityAvailable: "",
      condition: "GOOD",
      assignedToPlayerId: "",
      notes: "",
      status: "AVAILABLE",
    })
    setFiles([])
    setShowAddModal(false)
    setEditingItem(null)
    setEditingGroup(null)
  }

  const handleAddItem = async (data: {
    equipmentType: string
    customEquipmentName?: string
    quantity: number
    condition: string
    availability: string
    assignedToPlayerId?: string | null
    notes?: string
  }) => {
    if (!permissions.canCreate) {
      throw new Error("You do not have permission to create items")
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create item")
      }

      const newItem = await response.json()
      // Reload items to get all created items (if quantity > 1)
      const itemsResponse = await fetch(`/api/teams/${teamId}/inventory`)
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json()
        setItems(itemsData.items || [])
      } else {
        setItems([newItem, ...items])
      }
    } catch (error: any) {
      alert(error.message || "Error creating item")
      throw error
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check permissions
    if (editingItem && !permissions.canEdit) {
      alert("You do not have permission to edit items")
      return
    }
    
    if (!editingItem && !permissions.canCreate) {
      alert("You do not have permission to create items")
      return
    }

    if (!formData.name || !formData.category || !formData.quantityTotal) {
      alert("Name, category, and total quantity are required")
      return
    }

    setLoading(true)
    try {
      const url = editingItem
        ? `/api/teams/${teamId}/inventory/${editingItem.id}`
        : `/api/teams/${teamId}/inventory`
      const method = editingItem ? "PATCH" : "POST"

      // For position coaches editing, only send assignment changes
      const isPositionCoachEdit = editingItem && permissions.canAssign && !permissions.canEdit
      
      // If there are files, use FormData; otherwise use JSON
      if (files.length > 0 && !isPositionCoachEdit) {
        const formDataToSend = new FormData()
        formDataToSend.append("category", formData.category)
        formDataToSend.append("name", formData.name)
        formDataToSend.append("quantityTotal", formData.quantityTotal)
        formDataToSend.append("quantityAvailable", formData.quantityAvailable || formData.quantityTotal)
        formDataToSend.append("condition", formData.condition)
        formDataToSend.append("status", formData.status)
        formDataToSend.append("assignedToPlayerId", formData.assignedToPlayerId || "")
        formDataToSend.append("notes", formData.notes || "")
        
        files.forEach((file) => {
          formDataToSend.append("files", file)
        })

        const response = await fetch(url, {
          method,
          body: formDataToSend,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to save item")
        }

        const newItem = await response.json()
        if (editingItem) {
          setItems(items.map((item) => (item.id === editingItem.id ? newItem : item)))
        } else {
          setItems([newItem, ...items])
        }
        resetForm()
        return
      }

      // Otherwise, use JSON
      const payload: any = isPositionCoachEdit
        ? {
            assignedToPlayerId: formData.assignedToPlayerId || null,
          }
        : {
            ...formData,
            quantityTotal: parseInt(formData.quantityTotal),
            quantityAvailable: parseInt(formData.quantityAvailable || formData.quantityTotal),
            assignedToPlayerId: formData.assignedToPlayerId || null,
          }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save item")
      }

      const newItem = await response.json()
      if (editingItem) {
        setItems(items.map((item) => (item.id === editingItem.id ? newItem : item)))
      } else {
        setItems([newItem, ...items])
      }
      resetForm()
    } catch (error: any) {
      alert(error.message || "Error saving item")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!permissions.canDelete) {
      alert("You do not have permission to delete items")
      return
    }

    if (!confirm("Are you sure you want to delete this item?")) return

    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/inventory/${itemId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete item")
      }

      setItems(items.filter((item) => item.id !== itemId))
    } catch (error: any) {
      alert(error.message || "Error deleting item")
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      category: item.category,
      name: item.name,
      quantityTotal: item.quantityTotal.toString(),
      quantityAvailable: item.quantityAvailable.toString(),
      condition: item.condition,
      assignedToPlayerId: item.assignedToPlayerId || "",
      notes: item.notes || "",
      status: item.status,
    })
    // For now, use the legacy form for editing - can be updated to use modal later
    setShowAddForm(true)
  }

  const getStatusColor = (status: string) => {
    // All statuses use neutral styling
    return {
      backgroundColor: "rgb(var(--platinum))",
      borderColor: "rgb(var(--border))",
      color: "rgb(var(--text2))",
      borderWidth: "1px"
    }
  }

  const getConditionColor = (condition: string) => {
    // All conditions use neutral text color
    return {
      color: "rgb(var(--text2))"
    }
  }

  // Group items by equipment type
  const groupedItems = items.reduce((acc, item) => {
    const key = item.equipmentType || item.category || "UNKNOWN"
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(item)
    return acc
  }, {} as Record<string, InventoryItem[]>)


  // Get jersey label (P/H/A/T) based on jersey type
  const getJerseyLabel = (equipmentType: string | null | undefined, name?: string): string | null => {
    const type = (equipmentType || name || "").toLowerCase()
    
    // Check for practice jerseys (handles both singular and plural)
    if (type.includes("practice") && type.includes("jersey")) return "P"
    // Check for home jersey
    if (type.includes("home") && type.includes("jersey")) return "H"
    // Check for away jersey
    if (type.includes("away") && type.includes("jersey")) return "A"
    // Check for alternate jersey (tertiary)
    if (type.includes("alternate") && type.includes("jersey")) return "T"
    
    return null
  }

  const toggleGroup = (equipmentType: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(equipmentType)) {
      newExpanded.delete(equipmentType)
    } else {
      newExpanded.add(equipmentType)
    }
    setExpandedGroups(newExpanded)
  }

  const handleEditGroup = (equipmentType: string) => {
    const groupItems = groupedItems[equipmentType] || []
    if (groupItems.length === 0) return
    
    // Use the first item as a template for editing the group
    const firstItem = groupItems[0]
    setEditingGroup(equipmentType)
    setFormData({
      category: firstItem.category,
      name: firstItem.equipmentType || firstItem.category,
      quantityTotal: groupItems.length.toString(),
      quantityAvailable: groupItems.filter(i => !i.assignedToPlayerId).length.toString(),
      condition: firstItem.condition,
      assignedToPlayerId: "",
      notes: firstItem.notes || "",
      status: firstItem.status,
    })
    setShowAddForm(true)
  }

  const handleDeleteGroup = async (equipmentType: string) => {
    const groupItems = groupedItems[equipmentType] || []
    if (groupItems.length === 0) return

    if (!confirm(`Are you sure you want to delete all ${groupItems.length} items of type "${equipmentType}"?`)) return

    setLoading(true)
    try {
      // Delete all items in the group
      await Promise.all(
        groupItems.map((item) =>
          fetch(`/api/teams/${teamId}/inventory/${item.id}`, {
            method: "DELETE",
          })
        )
      )

      // Reload items
      const res = await fetch(`/api/teams/${teamId}/inventory`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (error: any) {
      alert(error.message || "Error deleting items")
    } finally {
      setLoading(false)
    }
  }

  const handleAssignItem = async (itemId: string, playerId: string | null) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToPlayerId: playerId,
          quantityAvailable: playerId ? 0 : 1,
          status: playerId ? "ASSIGNED" : "AVAILABLE",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to assign item")
      }

      // Reload items
      const res = await fetch(`/api/teams/${teamId}/inventory`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (error: any) {
      alert(error.message || "Error assigning item")
    } finally {
      setLoading(false)
    }
  }

  const handleReturnItem = async (itemId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToPlayerId: null,
          quantityAvailable: 1,
          status: "AVAILABLE",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to return item")
      }

      // Reload items
      const res = await fetch(`/api/teams/${teamId}/inventory`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (error: any) {
      alert(error.message || "Error returning item")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateItem = async (itemId: string, data: {
    condition: string
    status: string
    assignedToPlayerId?: string | null
    notes?: string
    size?: string
    make?: string
  }) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update item")
      }

      // Reload items
      const res = await fetch(`/api/teams/${teamId}/inventory`)
      if (res.ok) {
        const itemsData = await res.json()
        setItems(itemsData.items || [])
      }
    } catch (error: any) {
      alert(error.message || "Error updating item")
      throw error
    } finally {
      setLoading(false)
    }
  }

  const handlePrintLabel = (item: InventoryItem) => {
    if (!item.itemCode) {
      alert("No item code available for this item")
      return
    }

    const canPrint = (equipmentType: string | null | undefined) => {
      if (!equipmentType) return false
      const type = equipmentType.toLowerCase()
      return !type.includes("mouthpiece") && !type.includes("knee pad") && !type.includes("chinstrap")
    }

    if (!canPrint(item.equipmentType)) {
      alert("Labels are not available for this equipment type")
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

  const handleOpenItemsModal = (equipmentType: string) => {
    setSelectedEquipmentType(equipmentType)
    setItemsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">
          Inventory Items ({Object.keys(groupedItems).length} types, {items.length} total items)
        </h2>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`p-2 rounded transition-colors ${
                viewMode === "card" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted/50"
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
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          {permissions.canCreate && (
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {permissions.canCreate && (
        <AddItemModal
          open={showAddModal}
          onClose={() => {
            setShowAddModal(false)
            resetForm()
          }}
          onSubmit={handleAddItem}
          players={players}
          loading={loading}
        />
      )}

      {/* Edit Form - for editing groups or individual items */}
      {showAddForm && (editingItem || editingGroup) && (
        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              {editingGroup ? `Edit Equipment Type: ${editingGroup}` : editingItem ? "Edit Item" : "Add Inventory Item"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Group editing - only show condition, status, and notes */}
              {editingGroup ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Editing all items of type <strong>{editingGroup}</strong>. Changes will apply to all {groupedItems[editingGroup]?.length || 0} items.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="condition" className="text-foreground">Condition</Label>
                      <select
                        id="condition"
                        value={formData.condition}
                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="EXCELLENT">Excellent</option>
                        <option value="GOOD">Good</option>
                        <option value="FAIR">Fair</option>
                        <option value="NEEDS_REPAIR">Needs Repair</option>
                        <option value="REPLACE">Replace</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-foreground">Status</Label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="ASSIGNED">Assigned</option>
                        <option value="MISSING">Missing</option>
                        <option value="NEEDS_REPLACEMENT">Needs Replacement</option>
                        <option value="DAMAGED">Damaged</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-foreground">Notes</Label>
                    <textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="flex min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Additional notes for this equipment type..."
                    />
                  </div>
                </div>
              ) : permissions.canEdit && !(editingItem && permissions.canAssign && !permissions.canEdit) ? (
                <>
                  {/* Individual item editing - legacy support */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-foreground">Category *</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g., Helmets, Jerseys, Pads"
                        required
                        disabled={!!editingItem}
                        className="border-border bg-background text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-foreground">Item Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Helmet #12"
                        required
                        disabled={!!editingItem}
                        className="border-border bg-background text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantityTotal">Total Quantity *</Label>
                      <Input
                        id="quantityTotal"
                        type="number"
                        min="1"
                        value={formData.quantityTotal}
                        onChange={(e) => setFormData({ ...formData, quantityTotal: e.target.value })}
                        required
                        disabled={!!editingItem}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantityAvailable">Available</Label>
                      <Input
                        id="quantityAvailable"
                        type="number"
                        min="0"
                        value={formData.quantityAvailable}
                        onChange={(e) =>
                          setFormData({ ...formData, quantityAvailable: e.target.value })
                        }
                        disabled={!!editingItem}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="condition">Condition</Label>
                      <select
                        id="condition"
                        value={formData.condition}
                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                        className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        disabled={!!editingItem}
                      >
                        <option value="GOOD">Good</option>
                        <option value="FAIR">Fair</option>
                        <option value="NEEDS_REPAIR">Needs Repair</option>
                        <option value="REPLACE">Replace</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        disabled={!!editingItem}
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="ASSIGNED">Assigned</option>
                        <option value="MISSING">Missing</option>
                        <option value="NEEDS_REPLACEMENT">Needs Replacement</option>
                        <option value="DAMAGED">Damaged</option>
                      </select>
                    </div>
                    {permissions.canAssign && (
                      <div className="space-y-2">
                        <Label htmlFor="assignedToPlayerId">Assign to Player (Optional)</Label>
                        <select
                          id="assignedToPlayerId"
                          value={formData.assignedToPlayerId}
                          onChange={(e) =>
                            setFormData({ ...formData, assignedToPlayerId: e.target.value })
                          }
                          className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="">None</option>
                          {players.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.firstName} {player.lastName}
                              {player.jerseyNumber ? ` (#${player.jerseyNumber})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="flex min-h-[80px] w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Additional notes..."
                      disabled={!!editingItem}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="files">Attach Files (Optional)</Label>
                    <label
                      htmlFor="files"
                      className="flex h-11 w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm text-muted-foreground cursor-pointer items-center justify-center transition-all duration-200 hover:bg-muted/50"
                    >
                      <span>Click here to attach files</span>
                    </label>
                    <Input
                      id="files"
                      type="file"
                      multiple
                      onChange={(e) => {
                        const selectedFiles = Array.from(e.target.files || [])
                        setFiles(selectedFiles)
                      }}
                      disabled={!!editingItem}
                      className="hidden"
                    />
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {files.map((file, idx) => (
                          <div
                            key={idx}
                            className="text-xs px-2 py-1 rounded border border-border bg-muted/50 flex items-center gap-1"
                          >
                            <span>{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                // Position coaches can only assign/unassign
                permissions.canAssign && (
                  <div className="space-y-2">
                    <Label htmlFor="assignedToPlayerId">Assign to Player</Label>
                    <select
                      id="assignedToPlayerId"
                      value={formData.assignedToPlayerId}
                      onChange={(e) =>
                        setFormData({ ...formData, assignedToPlayerId: e.target.value })
                      }
                      className="flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">None (Return Item)</option>
                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.firstName} {player.lastName}
                          {player.jerseyNumber ? ` (#${player.jerseyNumber})` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-muted-foreground">
                      You can only assign or return items. Contact the Head Coach to modify other details.
                    </p>
                  </div>
                )
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {editingItem ? "Update" : "Add"} Item
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Inventory Display - Grouped by Equipment Type */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>No inventory items yet</p>
            {permissions.canCreate && (
              <Button
                onClick={() => setShowAddModal(true)}
                className="mt-4 bg-primary text-primary-foreground"
              >
                Add Your First Equipment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(groupedItems).map(([equipmentType, groupItems]) => {
            const totalItems = groupItems.length
            const availableItems = groupItems.filter(i => !i.assignedToPlayerId).length
            const assignedItems = groupItems.filter(i => i.assignedToPlayerId).length
            const firstItem = groupItems[0]
            
            // Get most common condition and status
            const conditions = groupItems.map(i => i.condition)
            const mostCommonCondition = conditions.sort((a, b) =>
              conditions.filter(v => v === a).length - conditions.filter(v => v === b).length
            ).pop() || "GOOD"
            
            const statuses = groupItems.map(i => i.status)
            const mostCommonStatus = statuses.sort((a, b) =>
              statuses.filter(v => v === a).length - statuses.filter(v => v === b).length
            ).pop() || "AVAILABLE"

            return (
              <Card key={equipmentType} className="border border-border bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-primary">
                      <EquipmentIcon 
                        equipmentType={equipmentType} 
                        category={firstItem?.category}
                        size={32}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1 text-foreground">
                        {equipmentType}
                      </h3>
                      <p className="text-sm mb-2 text-muted-foreground">
                        {totalItems} item{totalItems !== 1 ? "s" : ""} • {availableItems} available • {assignedItems} assigned
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs px-2 py-1 rounded border"
                          style={getStatusColor(mostCommonStatus)}
                        >
                          {mostCommonStatus.replace("_", " ")}
                        </span>
                        <span className="text-xs font-medium" style={getConditionColor(mostCommonCondition)}>
                          {mostCommonCondition.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      {(permissions.canEdit || permissions.canDelete) && (
                        <>
                          {permissions.canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditGroup(equipmentType)}
                              disabled={loading}
                              title="Edit Equipment Type"
                            >
                              <Edit className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {permissions.canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteGroup(equipmentType)}
                              disabled={loading}
                              title="Delete All Items"
                            >
                              <Trash2 className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenItemsModal(equipmentType)}
                      className="border-border text-foreground"
                    >
                      View Items
                    </Button>
                  </div>
                  {expandedGroups.has(equipmentType) && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                      {groupItems.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="p-2 rounded-md border border-border bg-muted/50 text-sm"
                        >
                          <p className="font-medium text-foreground">{item.name}</p>
                          {item.assignedPlayer && (
                            <p className="text-xs mt-1 text-muted-foreground">
                              Assigned to: {item.assignedPlayer.firstName} {item.assignedPlayer.lastName}
                            </p>
                          )}
                        </div>
                      ))}
                      {groupItems.length > 5 && (
                        <p className="text-xs text-center text-muted-foreground">
                          +{groupItems.length - 5} more items
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([equipmentType, groupItems]) => {
            const totalItems = groupItems.length
            const availableItems = groupItems.filter(i => !i.assignedToPlayerId).length
            const assignedItems = groupItems.filter(i => i.assignedToPlayerId).length
            const isExpanded = expandedGroups.has(equipmentType)
            const firstItem = groupItems[0]
            // Store viewMode in a variable to avoid TypeScript narrowing
            const currentViewMode = viewMode as "card" | "list"
            
            // Get most common condition and status
            const conditions = groupItems.map(i => i.condition)
            const mostCommonCondition = conditions.sort((a, b) =>
              conditions.filter(v => v === a).length - conditions.filter(v => v === b).length
            ).pop() || "GOOD"
            
            const statuses = groupItems.map(i => i.status)
            const mostCommonStatus = statuses.sort((a, b) =>
              statuses.filter(v => v === a).length - statuses.filter(v => v === b).length
            ).pop() || "AVAILABLE"

            return (
              <Card key={equipmentType} className="border border-border bg-card">
                <CardContent className="p-0">
                  {/* Group Header - Always Visible */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGroup(equipmentType)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div style={{ color: "rgb(var(--accent))" }}>
                          <EquipmentIcon 
                            equipmentType={equipmentType} 
                            category={firstItem?.category}
                            size={20}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-foreground">
                            {equipmentType}
                          </h3>
                          <div className="flex items-center gap-4 mt-1">
                            <p className="text-sm text-muted-foreground">
                              {totalItems} item{totalItems !== 1 ? "s" : ""} • {availableItems} available • {assignedItems} assigned
                            </p>
                            <span
                              className="text-xs px-2 py-1 rounded border"
                              style={getStatusColor(mostCommonStatus)}
                            >
                              {mostCommonStatus.replace("_", " ")}
                            </span>
                            <span className="text-xs font-medium" style={getConditionColor(mostCommonCondition)}>
                              {mostCommonCondition.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(permissions.canEdit || permissions.canDelete) && (
                          <>
                            {permissions.canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditGroup(equipmentType)
                                }}
                                disabled={loading}
                                title="Edit Equipment Type"
                              >
                                <Edit className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            {permissions.canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteGroup(equipmentType)
                                }}
                                disabled={loading}
                                title="Delete All Items"
                              >
                                <Trash2 className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenItemsModal(equipmentType)
                          }}
                          className="border-border text-foreground"
                        >
                          View Items
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Items Modal */}
      {selectedEquipmentType && (
        <InventoryItemsModal
          open={itemsModalOpen}
          onClose={() => {
            setItemsModalOpen(false)
            setSelectedEquipmentType(null)
          }}
          items={groupedItems[selectedEquipmentType] || []}
          players={players}
          equipmentType={selectedEquipmentType || ""}
          onAssignItem={handleAssignItem}
          onReturnItem={handleReturnItem}
          onUpdateItem={handleUpdateItem}
          permissions={permissions}
          loading={loading}
          viewMode={viewMode}
          teamId={teamId}
        />
      )}
    </div>
  )
}
