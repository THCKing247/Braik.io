"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, Package } from "lucide-react"

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(false)

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
    setShowAddForm(false)
    setEditingItem(null)
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

  const categories = Array.from(new Set(items.map((item) => item.category)))

  return (
    <div className="space-y-6">
      {permissions.canCreate && (
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Inventory Items</h2>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      )}

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingItem ? "Edit Item" : "Add Inventory Item"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Only show full edit fields if user can edit, otherwise only show assignment */}
              {permissions.canEdit && !(editingItem && permissions.canAssign && !permissions.canEdit) ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g., Helmets, Jerseys, Pads"
                        required
                        disabled={!!editingItem}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Item Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Helmet #12"
                        required
                        disabled={!!editingItem}
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
                        className="flex h-10 w-full rounded-md border-2 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
                        style={{ borderColor: "#0B2A5B" }}
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
                        className="flex h-10 w-full rounded-md border-2 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
                        style={{ borderColor: "#0B2A5B" }}
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
                          className="flex h-10 w-full rounded-md border-2 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
                          style={{ borderColor: "#0B2A5B" }}
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
                      className="flex min-h-[80px] w-full rounded-md border-2 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
                      style={{ borderColor: "#0B2A5B" }}
                      placeholder="Additional notes..."
                      disabled={!!editingItem}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="files">Attach Files (Optional)</Label>
                    <label
                      htmlFor="files"
                      className="flex h-11 w-full rounded-lg border-2 bg-white px-4 py-2.5 text-sm cursor-pointer items-center justify-center transition-all duration-200 hover:bg-gray-50"
                      style={{ borderColor: "#0B2A5B" }}
                    >
                      <span style={{ color: "#6B7280" }}>Click here to attach files</span>
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
                            className="text-xs px-2 py-1 rounded border-2 flex items-center gap-1"
                            style={{
                              backgroundColor: "rgb(var(--platinum))",
                              borderColor: "#0B2A5B",
                            }}
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
                      className="flex h-10 w-full rounded-md border-2 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2A5B] focus:ring-offset-2"
                      style={{ borderColor: "#0B2A5B" }}
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

      {/* Inventory List */}
      <div className="grid gap-4">
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted" />
              <p>No inventory items yet</p>
              {permissions.canCreate && (
                <Button onClick={() => setShowAddForm(true)} className="mt-4">
                  Add Your First Item
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg" style={{ color: "rgb(var(--text))" }}>{item.name}</h3>
                      <span
                        className="text-xs px-2 py-1 rounded border"
                        style={getStatusColor(item.status)}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                      <span className="text-sm font-medium" style={getConditionColor(item.condition)}>
                        {item.condition.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-sm space-y-1" style={{ color: "rgb(var(--text2))" }}>
                      <p>
                        <span className="font-medium">Category:</span> {item.category}
                      </p>
                      <p>
                        <span className="font-medium">Quantity:</span> {item.quantityAvailable} /{" "}
                        {item.quantityTotal} available
                      </p>
                      {item.assignedPlayer && (
                        <p>
                          <span className="font-medium">Assigned to:</span>{" "}
                          {item.assignedPlayer.firstName} {item.assignedPlayer.lastName}
                          {item.assignedPlayer.jerseyNumber
                            ? ` (#${item.assignedPlayer.jerseyNumber})`
                            : ""}
                        </p>
                      )}
                      {item.notes && (
                        <p>
                          <span className="font-medium">Notes:</span> {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  {(permissions.canEdit || permissions.canAssign || permissions.canDelete) && (
                    <div className="flex gap-2">
                      {(permissions.canEdit || permissions.canAssign) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          disabled={loading}
                          title={permissions.canAssign && !permissions.canEdit ? "Assign/Return Item" : "Edit Item"}
                        >
                          <Edit className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
                        </Button>
                      )}
                      {permissions.canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
