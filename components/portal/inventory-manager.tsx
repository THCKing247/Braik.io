"use client"

import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import type { InventoryCatalogCardRow } from "@/lib/teams/load-inventory-catalog"
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
  equipmentBatchId?: string | null
  equipmentBatchStatus?: string | null
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
  /** Load inventory via paginated + meta API (inventory page). */
  bootstrapInventory?: boolean
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

type PageSizeChoice = 10 | 25 | 50 | "all"

function readPageSizeFromSession(): PageSizeChoice {
  if (typeof window === "undefined") return 25
  const v = sessionStorage.getItem("inventoryPageSize")
  if (v === "10" || v === "25" || v === "50") return Number(v) as PageSizeChoice
  if (v === "all") return "all"
  return 25
}

function InventoryManagerInner({
  teamId,
  initialItems,
  players: initialPlayers,
  permissions,
  initialRecentUnitCostChanges = [],
  initialPendingConditionReportCount = 0,
  initialViewer = { canReportCondition: false, canApproveConditionReports: false },
  bootstrapInventory = false,
}: InventoryManagerProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const invType = (() => {
    const raw = searchParams.get("invType")
    return raw ? decodeURIComponent(raw) : null
  })()

  const catalogNavigate = useMemo(() => {
    const invDisplayLabel = (() => {
      const v = searchParams.get("invLabel")
      return v ? decodeURIComponent(v) : null
    })()
    return {
      invDisplayLabel,
      onRoot: () => {
        const p = new URLSearchParams(searchParams.toString())
        p.delete("invType")
        p.delete("invLabel")
        p.delete("invBucket")
        router.push(`${pathname}?${p.toString()}`)
      },
      onBucket: (bucket: string) => {
        const p = new URLSearchParams(searchParams.toString())
        p.delete("invType")
        p.delete("invLabel")
        p.set("invBucket", bucket)
        router.push(`${pathname}?${p.toString()}`)
      },
      onOpenType: (card: InventoryCatalogCardRow) => {
        const p = new URLSearchParams(searchParams.toString())
        p.set("invType", encodeURIComponent(card.equipmentTypeKey))
        p.set("invBucket", card.inventoryBucket)
        p.set("invLabel", encodeURIComponent(card.displayName))
        router.push(`${pathname}?${p.toString()}`)
      },
    }
  }, [pathname, router, searchParams])

  const [items, setItems] = useState(initialItems)
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [recentUnitCostChanges, setRecentUnitCostChanges] = useState<UnitCostChange[]>(
    initialRecentUnitCostChanges
  )
  const [pendingConditionReportCount, setPendingConditionReportCount] = useState(
    initialPendingConditionReportCount
  )
  const [viewer, setViewer] = useState<InventoryViewer>(initialViewer)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bootstrapLoading, setBootstrapLoading] = useState(bootstrapInventory)
  const [inventoryPage, setInventoryPage] = useState(1)
  const [bucketFilter, setBucketFilter] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [totalItemCount, setTotalItemCount] = useState(0)
  const [serverTabStats, setServerTabStats] = useState<{
    total: number
    available: number
    assigned: number
    needsAttention: number
  } | null>(null)
  const [catalogCards, setCatalogCards] = useState<InventoryCatalogCardRow[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [fetchAllLoading, setFetchAllLoading] = useState(false)
  const [pageSizeChoice, setPageSizeChoice] = useState<PageSizeChoice>(25)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPageSizeChoice(readPageSizeFromSession())
  }, [])

  useEffect(() => {
    const ib = searchParams.get("invBucket")
    if (ib === "Gear" || ib === "Uniforms" || ib === "Facilities" || ib === "Training Room" || ib === "Field" || ib === "All") {
      setBucketFilter(ib)
    }
  }, [searchParams])

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 320)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery])

  const applyMeta = useCallback((meta: {
    players?: Player[]
    recentUnitCostChanges?: UnitCostChange[]
    pendingConditionReportCount?: number
    viewer?: InventoryViewer
    tabStats?: { total: number; available: number; assigned: number; needsAttention: number }
  }) => {
    if (Array.isArray(meta.players)) setPlayers(meta.players)
    if (Array.isArray(meta.recentUnitCostChanges)) setRecentUnitCostChanges(meta.recentUnitCostChanges)
    if (typeof meta.pendingConditionReportCount === "number") {
      setPendingConditionReportCount(meta.pendingConditionReportCount)
    }
    if (meta.viewer) setViewer(meta.viewer)
    if (meta.tabStats) setServerTabStats(meta.tabStats)
  }, [])

  const runBootstrap = useCallback(async () => {
    if (!bootstrapInventory || !teamId) return
    setBootstrapLoading(true)
    try {
      const metaRes = await fetch(
        `/api/teams/${teamId}/inventory?meta=1&bucket=${encodeURIComponent(bucketFilter)}`
      )
      if (!metaRes.ok) {
        setBootstrapLoading(false)
        return
      }
      const meta = (await metaRes.json()) as Parameters<typeof applyMeta>[0]
      applyMeta(meta)

      if (!invType) {
        setCatalogLoading(true)
        const catRes = await fetch(
          `/api/teams/${teamId}/inventory?catalog=1&bucket=${encodeURIComponent(bucketFilter)}`
        )
        const catJ = catRes.ok ? await catRes.json() : { catalog: [] }
        setCatalogCards(Array.isArray(catJ.catalog) ? catJ.catalog : [])
        setCatalogLoading(false)
        setItems([])
        setTotalItemCount(0)
        setBootstrapLoading(false)
        return
      }

      const limitNum = pageSizeChoice === "all" ? 200 : pageSizeChoice
      const etQ = `&equipmentType=${encodeURIComponent(invType)}`

      if (pageSizeChoice === "all") {
        setFetchAllLoading(true)
        let allItems: InventoryItem[] = []
        let page = 1
        let total = 0
        while (true) {
          const pageRes = await fetch(
            `/api/teams/${teamId}/inventory?paginated=1&page=${page}&limit=200&bucket=${encodeURIComponent(bucketFilter)}&search=${encodeURIComponent(debouncedSearch)}${etQ}`
          )
          if (!pageRes.ok) break
          const pg = (await pageRes.json()) as {
            items?: InventoryItem[]
            totalCount?: number
            viewer?: InventoryViewer
          }
          total = typeof pg.totalCount === "number" ? pg.totalCount : total
          const chunk = Array.isArray(pg.items) ? pg.items : []
          allItems = allItems.concat(chunk)
          if (chunk.length < 200 || allItems.length >= total) break
          page += 1
        }
        setItems(allItems)
        setTotalItemCount(total)
        setFetchAllLoading(false)
        setBootstrapLoading(false)
        return
      }

      const pageRes = await fetch(
        `/api/teams/${teamId}/inventory?paginated=1&page=${inventoryPage}&limit=${limitNum}&bucket=${encodeURIComponent(bucketFilter)}&search=${encodeURIComponent(debouncedSearch)}${etQ}`
      )
      if (!pageRes.ok) {
        setBootstrapLoading(false)
        return
      }
      const pg = (await pageRes.json()) as {
        items?: InventoryItem[]
        totalCount?: number
        viewer?: InventoryViewer
      }
      setItems(Array.isArray(pg.items) ? pg.items : [])
      setTotalItemCount(typeof pg.totalCount === "number" ? pg.totalCount : 0)
      if (pg.viewer) setViewer(pg.viewer)
      setBootstrapLoading(false)
    } catch {
      setBootstrapLoading(false)
      setFetchAllLoading(false)
      setCatalogLoading(false)
    }
  }, [
    bootstrapInventory,
    teamId,
    bucketFilter,
    debouncedSearch,
    invType,
    inventoryPage,
    pageSizeChoice,
    applyMeta,
  ])

  useEffect(() => {
    void runBootstrap()
  }, [runBootstrap])

  const setPageSizeChoicePersist = useCallback((p: PageSizeChoice) => {
    setPageSizeChoice(p)
    if (typeof window !== "undefined") sessionStorage.setItem("inventoryPageSize", String(p))
    setInventoryPage(1)
  }, [])

  const setBucketFilterAndResetPage = useCallback(
    (b: string) => {
      setBucketFilter(b)
      setInventoryPage(1)
      if (bootstrapInventory) {
        const p = new URLSearchParams(searchParams.toString())
        p.set("invBucket", b)
        p.delete("invType")
        p.delete("invLabel")
        router.push(`${pathname}?${p.toString()}`)
      }
    },
    [bootstrapInventory, pathname, router, searchParams]
  )

  const reloadInventoryAfterMutation = useCallback(async () => {
    if (bootstrapInventory) {
      await runBootstrap()
      return
    }
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
  }, [bootstrapInventory, runBootstrap, teamId])

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

      await response.json()
      if (bootstrapInventory) {
        await reloadInventoryAfterMutation()
      } else {
        const itemsResponse = await fetch(`/api/teams/${teamId}/inventory`)
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json()
          mergeInventoryJson(itemsData, {
            setItems,
            setRecent: setRecentUnitCostChanges,
            setPending: setPendingConditionReportCount,
            setViewer,
          })
        }
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

      await reloadInventoryAfterMutation()
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

      await reloadInventoryAfterMutation()
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

      await reloadInventoryAfterMutation()
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

      await reloadInventoryAfterMutation()
    } catch (error: any) {
      alert(error.message || "Error deleting item")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (equipmentType: string) => {
    let groupItems = items.filter((item) => (item.equipmentType || item.category) === equipmentType)
    if (bootstrapInventory) {
      const res = await fetch(`/api/teams/${teamId}/inventory`)
      const data = res.ok ? await res.json() : {}
      groupItems = Array.isArray(data.items)
        ? data.items.filter((item: InventoryItem) => (item.equipmentType || item.category) === equipmentType)
        : []
    }
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

      await reloadInventoryAfterMutation()
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
      await reloadInventoryAfterMutation()
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
      let groupItems = items.filter((item) => (item.equipmentType || item.category) === equipmentType)
      if (bootstrapInventory) {
        const res = await fetch(`/api/teams/${teamId}/inventory`)
        const data = res.ok ? await res.json() : {}
        groupItems = Array.isArray(data.items)
          ? data.items.filter((item: InventoryItem) => (item.equipmentType || item.category) === equipmentType)
          : []
      }
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

      await reloadInventoryAfterMutation()
    } catch (error: any) {
      alert(error.message || "Error updating items")
      throw error
    } finally {
      setLoading(false)
    }
  }

  const limitForPages = pageSizeChoice === "all" ? Math.max(1, totalItemCount || 1) : pageSizeChoice
  const totalPages =
    pageSizeChoice === "all" ? 1 : Math.max(1, Math.ceil(totalItemCount / limitForPages))

  return (
    <InventoryTabbedLayout
      items={items}
      players={players}
      teamId={teamId}
      catalogNavigate={bootstrapInventory ? catalogNavigate : undefined}
      permissions={permissions}
      recentUnitCostChanges={recentUnitCostChanges}
      pendingConditionReportCount={pendingConditionReportCount}
      viewer={viewer}
      onRefreshInventory={reloadInventoryAfterMutation}
      onAddItem={handleAddItem}
      onUpdateItem={handleUpdateItem}
      onUpdateAllItems={handleUpdateAllItems}
      onBulkSetCostForItems={handleBulkSetCostForItems}
      onAssignItem={handleAssignItem}
      onReturnItem={handleReturnItem}
      onDeleteGroup={handleDeleteGroup}
      onDeleteItem={handleDeleteItem}
      loading={loading}
      inventoryBootstrapLoading={bootstrapInventory ? bootstrapLoading : false}
      totalInventoryCount={bootstrapInventory ? totalItemCount : undefined}
      inventoryPagination={
        bootstrapInventory
          ? {
              enabled: true,
              serverTabStats,
              page: inventoryPage,
              totalPages,
              onPageChange: setInventoryPage,
              bucketFilter,
              setBucketFilter: setBucketFilterAndResetPage,
              searchQuery,
              setSearchQuery,
              invType,
              catalogCards,
              catalogLoading,
              pageSizeChoice,
              setPageSizeChoice: setPageSizeChoicePersist,
              fetchAllLoading,
            }
          : undefined
      }
    />
  )
}

export function InventoryManager(props: InventoryManagerProps) {
  return (
    <Suspense fallback={<div className="min-h-[40vh] w-full animate-pulse rounded-xl bg-muted" aria-hidden />}>
      <InventoryManagerInner {...props} />
    </Suspense>
  )
}
