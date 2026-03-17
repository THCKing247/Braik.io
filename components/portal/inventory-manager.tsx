"use client"

import { useState } from "react"
import { InventoryTabbedLayout } from "./inventory-tabbed-layout"

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
  const [loading, setLoading] = useState(false)

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
    quantityTotal?: number
    quantityAvailable?: number
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

  const handleDeleteItem = async (itemId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/inventory/${itemId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete item")
      }

      // Reload items
      const res = await fetch(`/api/teams/${teamId}/inventory`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (error: any) {
      alert(error.message || "Error deleting item")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (equipmentType: string) => {
    const groupItems = items.filter(item => (item.equipmentType || item.category) === equipmentType)
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

  const handleUpdateAllItems = async (equipmentType: string, data: {
    condition?: string
    status?: string
    notes?: string
  }) => {
    setLoading(true)
    try {
      const groupItems = items.filter(item => (item.equipmentType || item.category) === equipmentType)
      
      // Update all items in the group
      await Promise.all(
        groupItems.map(item =>
          fetch(`/api/teams/${teamId}/inventory/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              condition: data.condition || item.condition,
              status: data.status || item.status,
              notes: data.notes !== undefined ? data.notes : item.notes,
            }),
          })
        )
      )

      // Reload items
      const res = await fetch(`/api/teams/${teamId}/inventory`)
      if (res.ok) {
        const itemsData = await res.json()
        setItems(itemsData.items || [])
      }
    } catch (error: any) {
      alert(error.message || "Error updating items")
      throw error
    } finally {
      setLoading(false)
    }
  }

  return (
    <InventoryTabbedLayout
      items={items}
      players={players}
      teamId={teamId}
      permissions={permissions}
      onAddItem={handleAddItem}
      onUpdateItem={handleUpdateItem}
      onUpdateAllItems={handleUpdateAllItems}
      onAssignItem={handleAssignItem}
      onReturnItem={handleReturnItem}
      onDeleteGroup={handleDeleteGroup}
      onDeleteItem={handleDeleteItem}
      loading={loading}
    />
  )
}
