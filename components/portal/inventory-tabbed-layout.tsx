"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Edit, Trash2, Printer, Search, LayoutGrid, List } from "lucide-react"
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
  quantityTotal?: number
  quantityAvailable?: number
  inventoryBucket?: string
  costPerUnit?: number | null
  costNotes?: string | null
  costUpdatedAt?: string | null
  damageReportText?: string | null
  damageReportedAt?: string | null
  assignedPlayer?: {
    id: string
    firstName: string
    lastName: string
    jerseyNumber?: number | null
  } | null
}

const INVENTORY_BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const
type BucketFilter = "All" | (typeof INVENTORY_BUCKETS)[number]

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })
}

function lineInvestment(item: InventoryItem): number {
  const unit = item.costPerUnit != null && !Number.isNaN(item.costPerUnit) ? item.costPerUnit : 0
  const qty = item.quantityTotal ?? 0
  return unit * qty
}

function InventoryExpenseLedger({
  items,
  expenseBreakdown,
  onBreakdownChange,
}: {
  items: InventoryItem[]
  expenseBreakdown: "all" | "category" | "type"
  onBreakdownChange: (v: "all" | "category" | "type") => void
}) {
  const rows = useMemo(() => {
    return items.map((i) => ({
      ...i,
      bucket: i.inventoryBucket || "Gear",
      type: i.equipmentType || i.category || "Other",
      line: lineInvestment(i),
      unit: i.costPerUnit,
    }))
  }, [items])

  const total = useMemo(() => rows.reduce((s, r) => s + r.line, 0), [rows])
  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.bucket, (m.get(r.bucket) || 0) + r.line))
    return m
  }, [rows])
  const byType = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.type, (m.get(r.type) || 0) + r.line))
    return m
  }, [rows])

  const largestCategory = useMemo((): { name: string; v: number } | null => {
    let best: { name: string; v: number } | null = null
    byCategory.forEach((v: number, name: string) => {
      if (!best || v > best.v) best = { name, v }
    })
    return best
  }, [byCategory])

  const recentCost = useMemo(() => {
    return [...items]
      .filter((i) => i.costUpdatedAt)
      .sort((a, b) => new Date(b.costUpdatedAt!).getTime() - new Date(a.costUpdatedAt!).getTime())
      .slice(0, 5)
  }, [items])

  const itemsWithoutCost = items.filter((i) => i.costPerUnit == null || Number.isNaN(i.costPerUnit)).length

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto inventory-modal-scroll p-1">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="p-4">
            <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Total inventory cost</p>
            <p className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>{formatMoney(total)}</p>
            {itemsWithoutCost > 0 && (
              <p className="text-xs mt-2" style={{ color: "rgb(var(--muted))" }}>
                {itemsWithoutCost} item{itemsWithoutCost !== 1 ? "s" : ""} without cost entered
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="p-4">
            <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Largest category</p>
            <p className="text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
              {largestCategory ? `${largestCategory.name} · ${formatMoney(largestCategory.v)}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="p-4">
            <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Recent cost updates</p>
            <ul className="text-sm space-y-1" style={{ color: "rgb(var(--text))" }}>
              {recentCost.length === 0 ? (
                <li style={{ color: "rgb(var(--muted))" }}>No updates yet</li>
              ) : (
                recentCost.map((i) => (
                  <li key={i.id} className="truncate">
                    {i.name}{" "}
                    <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                      {i.costUpdatedAt ? new Date(i.costUpdatedAt).toLocaleDateString() : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all" as const, label: "All" },
            { id: "category" as const, label: "By category" },
            { id: "type" as const, label: "By item type" },
          ]
        ).map((seg) => (
          <Button
            key={seg.id}
            type="button"
            size="sm"
            variant={expenseBreakdown === seg.id ? "default" : "outline"}
            onClick={() => onBreakdownChange(seg.id)}
            style={
              expenseBreakdown === seg.id
                ? { backgroundColor: "rgb(var(--accent))", color: "white" }
                : { borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }
            }
          >
            {seg.label}
          </Button>
        ))}
      </div>

      <Card className="border flex-1 min-h-0" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
        <CardContent className="p-0">
          {expenseBreakdown === "all" && (
            <div className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold bg-[rgb(var(--platinum))]" style={{ color: "rgb(var(--muted))" }}>
                <span className="col-span-3">Item</span>
                <span className="col-span-2">Category</span>
                <span className="col-span-2">Type</span>
                <span className="col-span-1 text-right">Qty</span>
                <span className="col-span-2 text-right">$/unit</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center"
                  style={{ color: "rgb(var(--text))" }}
                >
                  <span className="col-span-3 font-medium truncate">{r.name}</span>
                  <span className="col-span-2 truncate">{r.bucket}</span>
                  <span className="col-span-2 truncate">{r.type}</span>
                  <span className="col-span-1 text-right">{r.quantityTotal ?? 0}</span>
                  <span className="col-span-2 text-right">
                    {r.unit != null ? formatMoney(r.unit) : "—"}
                  </span>
                  <span className="col-span-2 text-right font-medium">{formatMoney(r.line)}</span>
                </div>
              ))}
            </div>
          )}
          {expenseBreakdown === "category" && (
            <div className="space-y-4 p-4">
              {INVENTORY_BUCKETS.map((bucket) => {
                const bucketRows = rows.filter((r) => r.bucket === bucket)
                const sub = bucketRows.reduce((s, r) => s + r.line, 0)
                if (bucketRows.length === 0) return null
                return (
                  <div key={bucket}>
                    <div className="flex justify-between items-baseline mb-2">
                      <h4 className="font-semibold" style={{ color: "rgb(var(--text))" }}>{bucket}</h4>
                      <span className="text-sm font-medium" style={{ color: "rgb(var(--accent))" }}>{formatMoney(sub)}</span>
                    </div>
                    <ul className="rounded-lg border divide-y text-sm" style={{ borderColor: "rgb(var(--border))" }}>
                      {bucketRows.map((r) => (
                        <li key={r.id} className="flex justify-between gap-2 px-3 py-2">
                          <span className="truncate">{r.name}</span>
                          <span className="shrink-0">{formatMoney(r.line)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
          {expenseBreakdown === "type" && (
            <div className="space-y-4 p-4">
              {Array.from(byType.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([typeName, subTotal]) => {
                  const typeRows = rows.filter((r) => r.type === typeName)
                  return (
                    <div key={typeName}>
                      <div className="flex justify-between items-baseline mb-2">
                        <h4 className="font-semibold" style={{ color: "rgb(var(--text))" }}>{typeName}</h4>
                        <span className="text-sm font-medium" style={{ color: "rgb(var(--accent))" }}>{formatMoney(subTotal)}</span>
                      </div>
                      <ul className="rounded-lg border divide-y text-sm" style={{ borderColor: "rgb(var(--border))" }}>
                        {typeRows.map((r) => (
                          <li key={r.id} className="flex justify-between gap-2 px-3 py-2">
                            <span className="truncate">
                              {r.name}{" "}
                              <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                                ×{r.quantityTotal ?? 0}
                              </span>
                            </span>
                            <span className="shrink-0">{formatMoney(r.line)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
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
    inventoryBucket: string
    costPerUnit?: number | null
    itemCode?: string
  }) => Promise<void>
  onUpdateItem: (itemId: string, data: {
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
  }) => Promise<void>
  onUpdateAllItems: (equipmentType: string, data: {
    condition?: string
    status?: string
    notes?: string
    quantity?: number
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
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null)
  const [returningItemId, setReturningItemId] = useState<string | null>(null)
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>("All")
  const [mainView, setMainView] = useState<"items" | "expenses">("items")
  const [expenseBreakdown, setExpenseBreakdown] = useState<"all" | "category" | "type">("all")

  const bucketFilteredItems = useMemo(() => {
    if (bucketFilter === "All") return items
    return items.filter((item) => (item.inventoryBucket || "Gear") === bucketFilter)
  }, [items, bucketFilter])

  // Group items by equipment type (within bucket filter)
  const groupedItems = useMemo(() => {
    return bucketFilteredItems.reduce((acc, item) => {
      const key = item.equipmentType || item.category || "UNKNOWN"
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(item)
      return acc
    }, {} as Record<string, InventoryItem[]>)
  }, [bucketFilteredItems])

  const equipmentTypes = Object.keys(groupedItems).sort()

  useEffect(() => {
    const keys = Object.keys(groupedItems).sort()
    if (keys.length === 0) return
    if (!activeTab || !keys.includes(activeTab)) {
      setActiveTab(keys[0])
    }
  }, [groupedItems, activeTab])

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!activeTab) return []
    const tabItems = groupedItems[activeTab] || []
    if (!searchQuery.trim()) return tabItems

    const query = searchQuery.toLowerCase().trim()
    return tabItems.filter((item) => {
      if (item.itemCode?.toLowerCase().includes(query)) return true
      if (item.inventoryBucket?.toLowerCase().includes(query)) return true
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
          <title>Equipment Labels — ${escPrint(activeTab)}</title>
          <style>
            @media print {
              @page { size: letter; margin: 0.4in; }
            }
            body {
              font-family: system-ui, Arial, sans-serif;
              display: grid;
              grid-template-columns: repeat(2, 3.25in);
              gap: 0.35in;
              padding: 0.15in;
              color: #111;
            }
            .label {
              border: 2px dashed #333;
              border-radius: 6px;
              padding: 0.2in 0.15in;
              min-height: 1.35in;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: stretch;
              page-break-inside: avoid;
            }
            .code {
              font-size: 22px;
              font-weight: 800;
              letter-spacing: 0.04em;
              text-align: center;
              margin-bottom: 0.12in;
              font-family: ui-monospace, monospace;
            }
            .name {
              font-size: 11px;
              font-weight: 600;
              text-align: center;
              line-height: 1.25;
              margin-bottom: 0.08in;
            }
            .meta {
              font-size: 9px;
              color: #444;
              text-align: center;
              line-height: 1.35;
            }
            .hint {
              margin-top: 0.1in;
              font-size: 8px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${itemsWithCodes
            .map(
              (item) => `
            <div class="label">
              <div class="code">${escPrint(item.itemCode || "")}</div>
              <div class="name">${escPrint(item.name)}</div>
              <div class="meta">${escPrint(item.inventoryBucket || "Gear")} · ${escPrint(item.equipmentType || item.category || "")}</div>
              <div class="hint">Attach to equipment — scan or match code to roster</div>
            </div>
          `
            )
            .join("")}
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
  }

  const escPrint = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")

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

  const mainViewToggleEl = (
    <div className="flex items-center gap-2 text-sm shrink-0" role="tablist" aria-label="Inventory view">
      <button
        type="button"
        role="tab"
        aria-selected={mainView === "items"}
        onClick={() => setMainView("items")}
        className="bg-transparent border-0 p-0 cursor-pointer transition-colors"
        style={{
          color: mainView === "items" ? "rgb(var(--accent))" : "rgb(var(--muted))",
          fontWeight: mainView === "items" ? 600 : 500,
        }}
      >
        Items
      </button>
      <span className="select-none" style={{ color: "rgb(var(--muted))" }} aria-hidden>
        |
      </span>
      <button
        type="button"
        role="tab"
        aria-selected={mainView === "expenses"}
        onClick={() => setMainView("expenses")}
        className="bg-transparent border-0 p-0 cursor-pointer transition-colors"
        style={{
          color: mainView === "expenses" ? "rgb(var(--accent))" : "rgb(var(--muted))",
          fontWeight: mainView === "expenses" ? 600 : 500,
        }}
      >
        Expenses
      </button>
    </div>
  )

  if (items.length === 0) {
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
    <div className="flex flex-col h-full min-h-0 gap-3">
      {mainView === "expenses" ? (
        <>
          {mainViewToggleEl}
          <InventoryExpenseLedger
            items={bucketFilteredItems}
            expenseBreakdown={expenseBreakdown}
            onBreakdownChange={setExpenseBreakdown}
          />
        </>
      ) : equipmentTypes.length === 0 ? (
        <div className="text-center py-10 rounded-lg border" style={{ borderColor: "rgb(var(--border))" }}>
          <p className="text-muted-foreground mb-3">No items match this category filter.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setBucketFilter("All")}>
            Show all items
          </Button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
      {/* Left Sidebar - item types */}
      <div className="w-64 flex-shrink-0 border-r" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="p-4 border-b" style={{ borderColor: "rgb(var(--border))" }}>
          <div className="mb-3">{mainViewToggleEl}</div>
          <div className="flex flex-col gap-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              {INVENTORY_BUCKETS.slice(0, 2).map((b) => {
                const active = bucketFilter === b
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBucketFilter(b)}
                    className="rounded-full border px-3 py-1.5 text-sm transition-colors truncate"
                    style={{
                      borderColor: active ? "rgb(var(--accent))" : "rgb(var(--border))",
                      backgroundColor: active ? "rgb(var(--accent))" : "#FFFFFF",
                      color: active ? "white" : "rgb(var(--text))",
                      fontWeight: active ? 600 : 400,
                    }}
                    title={b}
                  >
                    {b}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {INVENTORY_BUCKETS.slice(2).map((b) => {
                const active = bucketFilter === b
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBucketFilter(b)}
                    className="rounded-full border px-2 py-1.5 text-sm transition-colors truncate"
                    style={{
                      borderColor: active ? "rgb(var(--accent))" : "rgb(var(--border))",
                      backgroundColor: active ? "rgb(var(--accent))" : "#FFFFFF",
                      color: active ? "white" : "rgb(var(--text))",
                      fontWeight: active ? 600 : 400,
                    }}
                    title={b}
                  >
                    {b}
                  </button>
                )
              })}
            </div>
          </div>
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
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <InventoryIcon type={equipmentType} size={28} />
                  <span className="font-medium text-sm truncate" style={{ color: "rgb(var(--text))" }}>
                    {equipmentType}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "rgb(var(--muted))" }}>
                    ({typeItems.length})
                  </span>
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <InventoryIcon type={activeTab} size={28} />
                  <h2 className="text-xl font-semibold truncate" style={{ color: "rgb(var(--text))" }}>
                    {activeTab}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {permissions.canEdit && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-2"
                        style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                        title="Edit all in this type"
                        onClick={handleBulkEdit}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-2"
                        style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                        title="Print codes"
                        onClick={handleBulkPrint}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {permissions.canDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-2"
                      style={{ borderColor: "rgb(var(--border))", color: "#dc2626" }}
                      title="Delete all in this type"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
                          <div className="flex items-start gap-2 mb-3">
                            <div className="relative shrink-0">
                              <InventoryIcon type={item.equipmentType || item.category} />
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
                              <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgb(var(--muted))" }}>
                                {item.inventoryBucket || "Gear"}
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
                              {item.costPerUnit != null && !Number.isNaN(item.costPerUnit) && (
                                <p className="text-xs mb-1" style={{ color: "rgb(var(--text))" }}>
                                  Est. value: {formatMoney(lineInvestment(item))}
                                  <span className="text-[rgb(var(--muted))]"> ({formatMoney(item.costPerUnit)} × {item.quantityTotal ?? 0})</span>
                                </p>
                              )}
                              {item.damageReportText && (
                                <p className="text-xs mt-1 rounded border px-2 py-1" style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" }}>
                                  <span className="font-semibold">Damage report: </span>
                                  {item.damageReportText}
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
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="relative shrink-0">
                                <InventoryIcon type={item.equipmentType || item.category} />
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
                                <p className="text-[10px] uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                                  {item.inventoryBucket || "Gear"}
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
                                {item.costPerUnit != null && !Number.isNaN(item.costPerUnit) && (
                                  <p className="text-xs" style={{ color: "rgb(var(--text))" }}>
                                    {formatMoney(lineInvestment(item))} total
                                  </p>
                                )}
                                {item.damageReportText && (
                                  <p className="text-xs mt-1 text-red-800 font-medium truncate" title={item.damageReportText}>
                                    Damage report
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 mt-1">
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
          </div>
        </div>
      )}

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
          equipmentType={activeTab}
          itemCount={groupedItems[activeTab]?.length || 0}
          assignedCount={groupedItems[activeTab]?.filter(item => item.assignedToPlayerId).length || 0}
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
