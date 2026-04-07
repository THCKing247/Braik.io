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
  inventoryBucket?: string
  costPerUnit?: number | null
  costNotes?: string | null
  costUpdatedAt?: string | null
  damageReportText?: string | null
  damageReportedAt?: string | null
  damageReportedByPlayerId?: string | null
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

type UnitCostChange = {
  inventoryBucket: string
  equipmentType: string
  newCost: number | null
  changedAt: string
}

type InventoryViewer = {
  canReportCondition: boolean
  canApproveConditionReports: boolean
}

interface InventoryManagerProps {
  teamId: string
  initialItems: InventoryItem[]
  players: Player[]
  permissions: InventoryPermissions
  initialRecentUnitCostChanges?: UnitCostChange[]
  initialPendingConditionReportCount?: number
  initialViewer?: InventoryViewer
}

function mergeInventoryJson(
  data: {
    items?: InventoryItem[]
    recentUnitCostChanges?: UnitCostChange[]
    pendingConditionReportCount?: number
    viewer?: InventoryViewer
  },
  setters: {
    setItems: (v: InventoryItem[]) => void
    setRecent: (v: UnitCostChange[]) => void
    setPending: (v: number) => void
    setViewer: (v: InventoryViewer) => void
  }
) {
  if (Array.isArray(data.items)) setters.setItems(data.items)
  if (Array.isArray(data.recentUnitCostChanges)) setters.setRecent(data.recentUnitCostChanges)
  if (typeof data.pendingConditionReportCount === "number") setters.setPending(data.pendingConditionReportCount)
  if (data.viewer && typeof data.viewer === "object") setters.setViewer(data.viewer)
}

export function InventoryManager({
  teamId,
  initialItems,
  players,
  permissions,
  initialRecentUnitCostChanges = [],
  initialPendingConditionReportCount = 0,
  initialViewer = { canReportCondition: false, canApproveConditionReports: false },
}: InventoryManagerProps) {
  const [items, setItems] = useState(initialItems)
  const [recentUnitCostChanges, setRecentUnitCostChanges] = useState<UnitCostChange[]>(
    initialRecentUnitCostChanges
  )
  const [pendingConditionReportCount, setPendingConditionReportCount] = useState(
    initialPendingConditionReportCount
  )
  const [viewer, setViewer] = useState<InventoryViewer>(initialViewer)
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
    inventoryBucket?: string
    costPerUnit?: number | null
    itemCode?: string
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
        mergeInventoryJson(itemsData, {
          setItems,
          setRecent: setRecentUnitCostChanges,
          setPending: setPendingConditionReportCount,
          setViewer,
        })
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
        mergeInventoryJson(data, {
          setItems,
          setRecent: setRecentUnitCostChanges,
          setPending: setPendingConditionReportCount,
          setViewer,
        })
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
        mergeInventoryJson(data, {
          setItems,
          setRecent: setRecentUnitCostChanges,
          setPending: setPendingConditionReportCount,
          setViewer,
        })
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
    itemCode?: string
    inventoryBucket?: string
    costPerUnit?: number | null
    costNotes?: string
    clearDamageReport?: boolean
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
        mergeInventoryJson(itemsData, {
          setItems,
          setRecent: setRecentUnitCostChanges,
          setPending: setPendingConditionReportCount,
          setViewer,
        })
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
        mergeInventoryJson(data, {
          setItems,
          setRecent: setRecentUnitCostChanges,
          setPending: setPendingConditionReportCount,
          setViewer,
        })
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
        mergeInventoryJson(data, {
          setItems,
          setRecent: setRecentUnitCostChanges,
          setPending: setPendingConditionReportCount,
          setViewer,
        })
      }
    } catch (error: any) {
      alert(error.message || "Error deleting items")
    } finally {
      setLoading(false)
    }
  }

  const handleBulkSetCostForItems = async (args: {
    inventoryBucket: string
    equipmentType: string
    unitCost: number | null
  }) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/inventory/unit-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryBucket: args.inventoryBucket,
          equipmentType: args.equipmentType,
          unitCost: args.unitCost,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Failed to save unit cost")
      }
      const inv = await fetch(`/api/teams/${teamId}/inventory`)
      if (inv.ok) {
        const data = await inv.json()
        mergeInventoryJson(data, {
          setItems,
          setRecent: setRecentUnitCostChanges,
          setPending: setPendingConditionReportCount,
          setViewer,
        })
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Error updating unit price")
      throw error
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateAllItems = async (equipmentType: string, data: {
    condition?: string
    status?: string
    notes?: string
    quantity?: number
    inventoryBucket?: string
    equipmentType?: string
    costPerUnit?: number | null
  }) => {
    setLoading(true)
    try {
      const groupItems = items.filter(item => (item.equipmentType || item.category) === equipmentType)
      const currentQuantity = groupItems.length
      const assignedItems = groupItems.filter(item => item.assignedToPlayerId)
      const assignedCount = assignedItems.length
      const unassignedItems = groupItems.filter(item => !item.assignedToPlayerId)
      const minQuantity = assignedCount // Minimum quantity is the number of assigned items
      
      // Handle quantity adjustment if provided
      if (data.quantity !== undefined && data.quantity !== currentQuantity) {
        // Validate minimum quantity (cannot go below assigned count)
        if (data.quantity < minQuantity) {
          throw new Error(
            `Cannot set quantity to ${data.quantity}: minimum quantity is ${minQuantity} ` +
            `(${assignedCount} item${assignedCount !== 1 ? "s are" : " is"} currently assigned to players). ` +
            `Please unassign items first if you need to reduce the quantity below ${minQuantity}.`
          )
        }
        
        const quantityDiff = data.quantity - currentQuantity
        
        if (quantityDiff > 0) {
          // Need to add items
          // Get the first item to use as a template
          const templateItem = groupItems[0]
          if (!templateItem) {
            throw new Error("Cannot adjust quantity: no items found of this type")
          }
          
          // Create new items
          const response = await fetch(`/api/teams/${teamId}/inventory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              equipmentType: templateItem.equipmentType || templateItem.category,
              quantity: quantityDiff,
              condition: data.condition || templateItem.condition || "GOOD",
              availability: data.status || templateItem.status || "AVAILABLE",
              notes: data.notes !== undefined ? data.notes : templateItem.notes || undefined,
              inventoryBucket: templateItem.inventoryBucket || "Gear",
              costPerUnit: templateItem.costPerUnit ?? null,
            }),
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || "Failed to add items")
          }
        } else if (quantityDiff < 0) {
          // Need to remove items (only unassigned items can be removed)
          const itemsToRemove = Math.abs(quantityDiff)
          
          // Only allow removing unassigned items
          if (itemsToRemove > unassignedItems.length) {
            throw new Error(
              `Cannot remove ${itemsToRemove} items: only ${unassignedItems.length} unassigned items available. ` +
              `${assignedCount} item${assignedCount !== 1 ? "s are" : " is"} currently assigned to players and cannot be removed. ` +
              `Please unassign items first if you need to remove more.`
            )
          }
          
          // Delete only unassigned items
          const itemsToDelete = unassignedItems.slice(0, itemsToRemove)
          
          await Promise.all(
            itemsToDelete.map(item =>
              fetch(`/api/teams/${teamId}/inventory/${item.id}`, {
                method: "DELETE",
              })
            )
          )
        }
      }
      
      // Update all items in the group (if condition, status, or notes changed)
      // Reload items first if quantity was changed to get updated list
      let itemsToUpdate = groupItems
      if (data.quantity !== undefined && data.quantity !== currentQuantity) {
        const reloadRes = await fetch(`/api/teams/${teamId}/inventory`)
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json()
          itemsToUpdate = (reloadData.items || []).filter((item: InventoryItem) => 
            (item.equipmentType || item.category) === equipmentType
          )
        }
      }
      
      if (data.condition || data.status || data.notes !== undefined) {
        await Promise.all(
          itemsToUpdate.map((item: InventoryItem) =>
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
      }

      if (data.inventoryBucket) {
        await Promise.all(
          itemsToUpdate.map((item: InventoryItem) =>
            fetch(`/api/teams/${teamId}/inventory/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inventoryBucket: data.inventoryBucket }),
            })
          )
        )
      }

      if (data.equipmentType?.trim()) {
        const v = data.equipmentType.trim()
        await Promise.all(
          itemsToUpdate.map((item: InventoryItem) =>
            fetch(`/api/teams/${teamId}/inventory/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ equipmentType: v, category: v }),
            })
          )
        )
      }

      if (data.costPerUnit !== undefined) {
        await Promise.all(
          itemsToUpdate.map((item: InventoryItem) =>
            fetch(`/api/teams/${teamId}/inventory/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ costPerUnit: data.costPerUnit }),
            })
          )
        )
      }

      // Final reload to get all updates
      const res = await fetch(`/api/teams/${teamId}/inventory`)
      if (res.ok) {
        const itemsData = await res.json()
        mergeInventoryJson(itemsData, {
          setItems,
          setRecent: setRecentUnitCostChanges,
          setPending: setPendingConditionReportCount,
          setViewer,
        })
      }
    } catch (error: any) {
      alert(error.message || "Error updating items")
      throw error
    } finally {
      setLoading(false)
    }
  }

  const refreshInventoryFromServer = async () => {
    const res = await fetch(`/api/teams/${teamId}/inventory`)
    if (res.ok) {
      const data = await res.json()
      mergeInventoryJson(data, {
        setItems,
        setRecent: setRecentUnitCostChanges,
        setPending: setPendingConditionReportCount,
        setViewer,
      })
    }
  }

  return (
    <InventoryTabbedLayout
      items={items}
      players={players}
      teamId={teamId}
      permissions={permissions}
      recentUnitCostChanges={recentUnitCostChanges}
      pendingConditionReportCount={pendingConditionReportCount}
      viewer={viewer}
      onRefreshInventory={refreshInventoryFromServer}
      onAddItem={handleAddItem}
      onUpdateItem={handleUpdateItem}
      onUpdateAllItems={handleUpdateAllItems}
      onBulkSetCostForItems={handleBulkSetCostForItems}
      onAssignItem={handleAssignItem}
      onReturnItem={handleReturnItem}
      onDeleteGroup={handleDeleteGroup}
      onDeleteItem={handleDeleteItem}
      loading={loading}
    />
  )
}
