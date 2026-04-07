"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Edit, Trash2, Printer, Search, LayoutGrid, List, Plus, ChevronDown, ChevronRight, Download } from "lucide-react"
import { InventoryIcon } from "./inventory-icon"
import { EditItemModal } from "./edit-item-modal"
import { AddItemModal } from "./add-item-modal"
import { BulkEditModal } from "./bulk-edit-modal"
import { PortalUnderlineTabs, type PortalUnderlineTab } from "./portal-underline-tabs"
import { isPlayerAssignableBucket } from "@/lib/inventory-category-policy"

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

function hasEnteredCost(item: InventoryItem): boolean {
  return item.costPerUnit != null && !Number.isNaN(item.costPerUnit)
}

function lineInvestment(item: InventoryItem): number {
  if (!hasEnteredCost(item)) return 0
  const unit = item.costPerUnit as number
  const qty = item.quantityTotal ?? 0
  return unit * qty
}

type ExpenseGroupRow = {
  key: string
  bucket: string
  typeKey: string
  items: InventoryItem[]
  totalQty: number
  totalLine: number
  uniformUnit: number | null
}

function buildCompositeGroups(inv: InventoryItem[]): ExpenseGroupRow[] {
  const m = new Map<string, ExpenseGroupRow>()
  for (const i of inv) {
    const bucket = i.inventoryBucket || "Gear"
    const typeKey = i.equipmentType || i.category || "Other"
    const key = `${bucket}||${typeKey}`
    if (!m.has(key)) {
      m.set(key, { key, bucket, typeKey, items: [], totalQty: 0, totalLine: 0, uniformUnit: null })
    }
    m.get(key)!.items.push(i)
  }
  for (const g of m.values()) {
    g.totalQty = g.items.reduce((s, x) => s + (x.quantityTotal ?? 0), 0)
    g.totalLine = g.items.reduce((s, x) => s + lineInvestment(x), 0)
    const units = g.items.map((x) => x.costPerUnit).filter((u) => u != null && !Number.isNaN(u as number)) as number[]
    g.uniformUnit = units.length === 0 ? null : units.every((u) => u === units[0]) ? units[0] : null
  }
  return [...m.values()].sort((a, b) => {
    const c = a.bucket.localeCompare(b.bucket)
    if (c !== 0) return c
    return a.typeKey.localeCompare(b.typeKey)
  })
}

function ExpenseGroupUnitCell({
  groupKey,
  uniformUnit,
  canEdit,
  disabled,
  onSave,
}: {
  groupKey: string
  uniformUnit: number | null
  canEdit: boolean
  disabled: boolean
  onSave: (cost: number | null) => Promise<void>
}) {
  const [draft, setDraft] = useState("")
  useEffect(() => {
    if (uniformUnit != null && !Number.isNaN(uniformUnit)) setDraft(String(uniformUnit))
    else setDraft("")
  }, [uniformUnit, groupKey])

  if (!canEdit) {
    return (
      <span className="text-right block">
        {uniformUnit != null ? formatMoney(uniformUnit) : <span style={{ color: "rgb(var(--muted))" }}>—</span>}
      </span>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="number"
        min={0}
        step="0.01"
        className="h-8 max-w-[7rem] text-right text-sm placeholder:text-muted-foreground/70"
        disabled={disabled}
        value={draft}
        placeholder="Enter cost"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          const t = draft.trim()
          if (t === "") {
            await onSave(null)
            return
          }
          const n = parseFloat(t)
          if (Number.isNaN(n) || n < 0) return
          await onSave(n)
        }}
        aria-label="Unit price"
      />
    </div>
  )
}

type UnitCostChangeRow = {
  inventoryBucket: string
  equipmentType: string
  newCost: number | null
  changedAt: string
}

function InventoryExpenseLedger({
  items,
  expenseBreakdown,
  onBreakdownChange,
  canEdit,
  onBulkSetCost,
  recentUnitCostChanges,
}: {
  items: InventoryItem[]
  expenseBreakdown: "all" | "category" | "type"
  onBreakdownChange: (v: "all" | "category" | "type") => void
  canEdit: boolean
  onBulkSetCost: (args: {
    inventoryBucket: string
    equipmentType: string
    unitCost: number | null
  }) => Promise<void>
  recentUnitCostChanges: UnitCostChangeRow[]
}) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [expandedTypeKeys, setExpandedTypeKeys] = useState<Set<string>>(() => new Set())
  const [allSort, setAllSort] = useState<{
    key: "bucket" | "type" | "qty" | "unit" | "total"
    dir: "asc" | "desc"
  }>({ key: "bucket", dir: "asc" })

  const compositeGroups = useMemo(() => buildCompositeGroups(items), [items])

  const totalWithCosts = useMemo(
    () => items.reduce((s, i) => s + (hasEnteredCost(i) ? lineInvestment(i) : 0), 0),
    [items]
  )
  const anyCostEntered = totalWithCosts > 0

  const byCategoryTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) {
      if (!hasEnteredCost(i)) continue
      const b = i.inventoryBucket || "Gear"
      m.set(b, (m.get(b) || 0) + lineInvestment(i))
    }
    return m
  }, [items])

  const largestCategory = useMemo((): { name: string; v: number } | null => {
    let best: { name: string; v: number } | null = null
    byCategoryTotals.forEach((v: number, name: string) => {
      if (v <= 0) return
      if (!best || v > best.v) best = { name, v }
    })
    return best
  }, [byCategoryTotals])

  const itemsWithoutCost = items.filter((i) => !hasEnteredCost(i)).length

  const expenseBreakdownTabs: PortalUnderlineTab[] = [
    { id: "all", label: "All" },
    { id: "category", label: "By category" },
    { id: "type", label: "By item type" },
  ]

  const saveUnit = async (g: ExpenseGroupRow, cost: number | null) => {
    if (g.items.length === 0) return
    setSavingKey(g.key)
    try {
      await onBulkSetCost({
        inventoryBucket: g.bucket,
        equipmentType: g.typeKey,
        unitCost: cost,
      })
    } finally {
      setSavingKey(null)
    }
  }

  const sortedAllGroups = useMemo(() => {
    const rows = [...compositeGroups]
    const mult = allSort.dir === "asc" ? 1 : -1
    rows.sort((a, b) => {
      if (allSort.key === "bucket") {
        const c = a.bucket.localeCompare(b.bucket) * mult
        if (c !== 0) return c
        return a.typeKey.localeCompare(b.typeKey) * mult
      }
      if (allSort.key === "type") return a.typeKey.localeCompare(b.typeKey) * mult
      if (allSort.key === "qty") return (a.totalQty - b.totalQty) * mult
      if (allSort.key === "unit") {
        const au = a.uniformUnit ?? -1
        const bu = b.uniformUnit ?? -1
        return (au - bu) * mult
      }
      return (a.totalLine - b.totalLine) * mult
    })
    return rows
  }, [compositeGroups, allSort])

  const toggleTypeExpand = useCallback((key: string) => {
    setExpandedTypeKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const exportCsv = useCallback(() => {
    const lines = [
      ["item_type", "category", "quantity", "unit_cost", "total_cost", "last_updated"].join(","),
    ]
    for (const g of compositeGroups) {
      const last = g.items
        .map((i) => i.costUpdatedAt)
        .filter(Boolean)
        .sort()
        .pop()
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
      lines.push(
        [
          esc(g.typeKey),
          esc(g.bucket),
          String(g.totalQty),
          g.uniformUnit != null ? String(g.uniformUnit) : "",
          g.totalLine > 0 ? String(g.totalLine.toFixed(2)) : "",
          last ? esc(new Date(last).toISOString()) : "",
        ].join(",")
      )
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "inventory-expenses.csv"
    a.click()
    URL.revokeObjectURL(url)
  }, [compositeGroups])

  const budgetDen = totalWithCosts > 0 ? totalWithCosts : 1

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto inventory-modal-scroll p-1">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="p-4">
            <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Total inventory cost</p>
            {anyCostEntered ? (
              <p className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>{formatMoney(totalWithCosts)}</p>
            ) : (
              <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>No costs entered yet</p>
            )}
            {itemsWithoutCost > 0 && anyCostEntered && (
              <p className="text-xs mt-2" style={{ color: "rgb(var(--muted))" }}>
                {itemsWithoutCost} physical item{itemsWithoutCost !== 1 ? "s" : ""} still missing a unit cost
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="p-4">
            <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Largest category</p>
            <p className="text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
              {largestCategory ? `${largestCategory.name} · ${formatMoney(largestCategory.v)}` : anyCostEntered ? "—" : "—"}
            </p>
            {!anyCostEntered && (
              <p className="text-xs mt-1" style={{ color: "rgb(var(--muted))" }}>Enter unit costs to compare categories</p>
            )}
          </CardContent>
        </Card>
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="p-4">
            <p className="text-xs mb-1" style={{ color: "rgb(var(--muted))" }}>Recent cost updates</p>
            <ul className="text-sm space-y-1" style={{ color: "rgb(var(--text))" }}>
              {recentUnitCostChanges.length === 0 ? (
                <li style={{ color: "rgb(var(--muted))" }}>No costs entered yet</li>
              ) : (
                recentUnitCostChanges.slice(0, 3).map((u, idx) => (
                  <li key={`${u.inventoryBucket}-${u.equipmentType}-${u.changedAt}-${idx}`} className="truncate">
                    <span className="font-medium">{u.equipmentType}</span>{" "}
                    {u.newCost != null ? formatMoney(u.newCost) : "—"}{" "}
                    <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                      {new Date(u.changedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 lg:max-w-4xl">
        <PortalUnderlineTabs
          compact
          tabs={expenseBreakdownTabs}
          value={expenseBreakdown}
          onValueChange={(id) => onBreakdownChange(id as "all" | "category" | "type")}
          ariaLabel="Expense breakdown"
          className="flex-1 min-w-0 border-0 -mx-2"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
          onClick={exportCsv}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </Button>
      </div>

      <Card className="border flex-1 min-h-0" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
        <CardContent className="p-0">
          {expenseBreakdown === "all" && (
            <div className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold bg-[rgb(var(--platinum))]" style={{ color: "rgb(var(--muted))" }}>
                <button
                  type="button"
                  className="col-span-2 text-left underline-offset-2 hover:underline"
                  onClick={() =>
                    setAllSort((s) => ({
                      key: "bucket",
                      dir: s.key === "bucket" && s.dir === "asc" ? "desc" : "asc",
                    }))
                  }
                >
                  Category
                </button>
                <button
                  type="button"
                  className="col-span-3 text-left underline-offset-2 hover:underline"
                  onClick={() =>
                    setAllSort((s) => ({
                      key: "type",
                      dir: s.key === "type" && s.dir === "asc" ? "desc" : "asc",
                    }))
                  }
                >
                  Equipment type
                </button>
                <button
                  type="button"
                  className="col-span-2 text-right underline-offset-2 hover:underline"
                  onClick={() =>
                    setAllSort((s) => ({
                      key: "qty",
                      dir: s.key === "qty" && s.dir === "asc" ? "desc" : "asc",
                    }))
                  }
                >
                  Qty
                </button>
                <button
                  type="button"
                  className="col-span-2 text-right underline-offset-2 hover:underline"
                  onClick={() =>
                    setAllSort((s) => ({
                      key: "unit",
                      dir: s.key === "unit" && s.dir === "asc" ? "desc" : "asc",
                    }))
                  }
                >
                  $/unit
                </button>
                <button
                  type="button"
                  className="col-span-3 text-right underline-offset-2 hover:underline"
                  onClick={() =>
                    setAllSort((s) => ({
                      key: "total",
                      dir: s.key === "total" && s.dir === "asc" ? "desc" : "asc",
                    }))
                  }
                >
                  Total
                </button>
              </div>
              {sortedAllGroups.map((g) => (
                <div
                  key={g.key}
                  className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center"
                  style={{ color: "rgb(var(--text))" }}
                >
                  <span className="col-span-2 truncate">{g.bucket}</span>
                  <span className="col-span-3 font-medium truncate">{g.typeKey}</span>
                  <span className="col-span-2 text-right">{g.totalQty}</span>
                  <span className="col-span-2">
                    <ExpenseGroupUnitCell
                      groupKey={g.key}
                      uniformUnit={g.uniformUnit}
                      canEdit={canEdit}
                      disabled={savingKey === g.key}
                      onSave={(cost) => saveUnit(g, cost)}
                    />
                  </span>
                  <span className="col-span-3 text-right font-medium">
                    {g.uniformUnit != null ? formatMoney(g.totalLine) : <span style={{ color: "rgb(var(--muted))" }}>—</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {expenseBreakdown === "category" && (
            <div className="space-y-6 p-4">
              {INVENTORY_BUCKETS.map((bucket) => {
                const inBucket = items.filter((i) => (i.inventoryBucket || "Gear") === bucket)
                if (inBucket.length === 0) return null
                const sub = inBucket.reduce((s, i) => s + (hasEnteredCost(i) ? lineInvestment(i) : 0), 0)
                const inner = buildCompositeGroups(inBucket)
                const pct = budgetDen > 0 ? Math.round((sub / budgetDen) * 1000) / 10 : 0
                return (
                  <div key={bucket}>
                    <div className="flex justify-between items-baseline mb-2 gap-2">
                      <div>
                        <h4 className="font-semibold" style={{ color: "rgb(var(--text))" }}>{bucket}</h4>
                        <p className="text-[11px] mt-0.5" style={{ color: "rgb(var(--muted))" }}>
                          {isPlayerAssignableBucket(bucket) ? "Player equipment" : "Program inventory"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium block" style={{ color: "rgb(var(--accent))" }}>
                          {sub > 0 ? formatMoney(sub) : "—"}
                        </span>
                        {anyCostEntered && sub > 0 && (
                          <span className="text-xs" style={{ color: "rgb(var(--muted))" }}>{pct}% of tracked budget</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border divide-y text-sm" style={{ borderColor: "rgb(var(--border))" }}>
                      {inner.map((g) => (
                        <div
                          key={g.key}
                          className="grid grid-cols-12 gap-2 px-3 py-2 items-center"
                          style={{ color: "rgb(var(--text))" }}
                        >
                          <span className="col-span-4 font-medium truncate">{g.typeKey}</span>
                          <span className="col-span-2 text-right">{g.totalQty}</span>
                          <span className="col-span-3">
                            <ExpenseGroupUnitCell
                              groupKey={g.key}
                              uniformUnit={g.uniformUnit}
                              canEdit={canEdit}
                              disabled={savingKey === g.key}
                              onSave={(cost) => saveUnit(g, cost)}
                            />
                          </span>
                          <span className="col-span-3 text-right font-medium">
                            {g.uniformUnit != null ? formatMoney(g.totalLine) : <span style={{ color: "rgb(var(--muted))" }}>—</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {expenseBreakdown === "type" && (
            <div className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold bg-[rgb(var(--platinum))]" style={{ color: "rgb(var(--muted))" }}>
                <span className="col-span-5">Equipment type</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">$/unit</span>
                <span className="col-span-3 text-right">Total</span>
              </div>
              {compositeGroups.map((g) => {
                const open = expandedTypeKeys.has(g.key)
                const notes = [...new Set(g.items.map((i) => (i.notes ?? "").trim()).filter(Boolean))].join(" · ")
                return (
                  <div key={g.key} className="text-sm" style={{ color: "rgb(var(--text))" }}>
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      <div className="col-span-5 flex items-start gap-1 min-w-0">
                        <button
                          type="button"
                          className="p-0.5 mt-0.5 rounded hover:bg-[rgb(var(--platinum))]"
                          aria-expanded={open}
                          onClick={() => toggleTypeExpand(g.key)}
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{g.typeKey}</div>
                          <div className="text-[11px] truncate" style={{ color: "rgb(var(--muted))" }}>{g.bucket}</div>
                        </div>
                      </div>
                      <span className="col-span-2 text-right">{g.totalQty}</span>
                      <span className="col-span-2">
                        <ExpenseGroupUnitCell
                          groupKey={g.key}
                          uniformUnit={g.uniformUnit}
                          canEdit={canEdit}
                          disabled={savingKey === g.key}
                          onSave={(cost) => saveUnit(g, cost)}
                        />
                      </span>
                      <span className="col-span-3 text-right font-medium">
                        {g.uniformUnit != null ? formatMoney(g.totalLine) : <span style={{ color: "rgb(var(--muted))" }}>—</span>}
                      </span>
                    </div>
                    {open && (
                      <div className="px-4 pb-3 pl-11 text-xs space-y-1" style={{ color: "rgb(var(--muted))" }}>
                        <p><span className="font-semibold" style={{ color: "rgb(var(--text))" }}>Category:</span> {g.bucket}</p>
                        {notes ? <p><span className="font-semibold" style={{ color: "rgb(var(--text))" }}>Notes:</span> {notes}</p> : null}
                      </div>
                    )}
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
    inventoryBucket?: string
    equipmentType?: string
    costPerUnit?: number | null
  }) => Promise<void>
  onBulkSetCostForItems: (args: {
    inventoryBucket: string
    equipmentType: string
    unitCost: number | null
  }) => Promise<void>
  onAssignItem: (itemId: string, playerId: string | null) => Promise<void>
  onReturnItem: (itemId: string) => Promise<void>
  onDeleteGroup: (equipmentType: string) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
  loading: boolean
  recentUnitCostChanges: UnitCostChangeRow[]
  pendingConditionReportCount: number
  viewer: { canReportCondition: boolean; canApproveConditionReports: boolean }
  onRefreshInventory: () => Promise<void>
}

type ConditionReportRow = {
  id: string
  itemId: string
  itemName: string
  inventoryBucket: string
  equipmentType: string
  reportedByName: string
  reportedCondition: string
  note: string | null
  status: string
  createdAt: string
}

export function InventoryTabbedLayout({
  items,
  players,
  teamId,
  permissions,
  onAddItem,
  onUpdateItem,
  onUpdateAllItems,
  onBulkSetCostForItems,
  onAssignItem,
  onReturnItem,
  onDeleteGroup,
  onDeleteItem,
  loading,
  recentUnitCostChanges,
  pendingConditionReportCount,
  viewer,
  onRefreshInventory,
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
  const [expenseBreakdown, setExpenseBreakdown] = useState<"all" | "category" | "type">("type")
  const [conditionQueue, setConditionQueue] = useState<ConditionReportRow[]>([])
  const [conditionPanelOpen, setConditionPanelOpen] = useState(false)
  const [conditionActionId, setConditionActionId] = useState<string | null>(null)

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    fetch(`/api/teams/${teamId}/inventory/condition-reports`)
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((d: { reports?: ConditionReportRow[] }) => {
        if (!cancelled) setConditionQueue(Array.isArray(d.reports) ? d.reports : [])
      })
      .catch(() => {
        if (!cancelled) setConditionQueue([])
      })
    return () => {
      cancelled = true
    }
  }, [teamId, mainView, pendingConditionReportCount])

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
    setActiveTab((prev) => (prev && keys.includes(prev) ? prev : keys[0]))
  }, [groupedItems])

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

  /** When browsing with bucket "All", group the main list by inventory category for clearer scanning. */
  const displayItemSections = useMemo(() => {
    if (bucketFilter !== "All") {
      return [{ bucketLabel: null as string | null, items: filteredItems }]
    }
    const order = [...INVENTORY_BUCKETS]
    const map = new Map<string, InventoryItem[]>()
    for (const item of filteredItems) {
      const b = item.inventoryBucket || "Gear"
      if (!map.has(b)) map.set(b, [])
      map.get(b)!.push(item)
    }
    const sections: { bucketLabel: string; items: InventoryItem[] }[] = []
    const used = new Set<string>()
    for (const b of order) {
      const arr = map.get(b)
      if (arr?.length) {
        sections.push({ bucketLabel: b, items: arr })
        used.add(b)
      }
    }
    for (const b of [...map.keys()].sort()) {
      if (!used.has(b)) {
        const arr = map.get(b)
        if (arr?.length) sections.push({ bucketLabel: b, items: arr })
      }
    }
    return sections
  }, [bucketFilter, filteredItems])

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
    if (condition === "NEEDS_REPAIR" || condition === "NEEDS_REPLACEMENT" || condition === "REPLACE") return { color: "#991b1b" }
    return { color: "rgb(var(--text))" }
  }

  const reviewConditionReport = async (reportId: string, action: "approve" | "dismiss") => {
    setConditionActionId(reportId)
    try {
      const res = await fetch(`/api/teams/${teamId}/inventory/condition-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? "Update failed")
      }
      await onRefreshInventory()
      const r2 = await fetch(`/api/teams/${teamId}/inventory/condition-reports`)
      const d = r2.ok ? await r2.json() : { reports: [] }
      setConditionQueue(Array.isArray(d.reports) ? d.reports : [])
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed")
    } finally {
      setConditionActionId(null)
    }
  }

  const bucketTabs: PortalUnderlineTab[] = [
    { id: "All", label: "All" },
    ...INVENTORY_BUCKETS.map((b) => ({ id: b, label: b })),
  ]

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
      <PortalUnderlineTabs
        emphasized
        tabs={[
          {
            id: "items",
            label: (
              <span className="inline-flex items-center gap-2">
                Items
                {viewer.canApproveConditionReports && pendingConditionReportCount > 0 ? (
                  <span
                    className="rounded-full min-w-[1.25rem] px-1.5 py-0.5 text-center text-[11px] font-semibold text-white"
                    style={{ backgroundColor: "#d97706" }}
                  >
                    {pendingConditionReportCount}
                  </span>
                ) : null}
              </span>
            ),
          },
          { id: "expenses", label: "Expenses" },
        ]}
        value={mainView}
        onValueChange={(id) => setMainView(id as "items" | "expenses")}
        ariaLabel="Inventory Items or Expenses"
      />

      {mainView === "expenses" ? (
        <>
          <PortalUnderlineTabs
            compact
            tabs={bucketTabs}
            value={bucketFilter}
            onValueChange={(id) => setBucketFilter(id as BucketFilter)}
            ariaLabel="Inventory category filter"
          />
          {bucketFilter !== "All" && (
            <p className="text-[11px] -mt-1 lg:max-w-5xl" style={{ color: "rgb(var(--muted))" }}>
              {isPlayerAssignableBucket(bucketFilter)
                ? "Player equipment — costs roll up to assignable gear and uniforms."
                : "Program inventory — replacement and facility costs (not assigned to players)."}
            </p>
          )}
          <InventoryExpenseLedger
            items={bucketFilteredItems}
            expenseBreakdown={expenseBreakdown}
            onBreakdownChange={setExpenseBreakdown}
            canEdit={permissions.canEdit}
            onBulkSetCost={onBulkSetCostForItems}
            recentUnitCostChanges={recentUnitCostChanges}
          />
        </>
      ) : equipmentTypes.length === 0 ? (
        <div className="flex flex-col gap-3">
          <PortalUnderlineTabs
            compact
            tabs={bucketTabs}
            value={bucketFilter}
            onValueChange={(id) => setBucketFilter(id as BucketFilter)}
            ariaLabel="Inventory category filter"
          />
          <div className="text-center py-10 rounded-lg border" style={{ borderColor: "rgb(var(--border))" }}>
            <p className="text-muted-foreground mb-3">No items match this category filter.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setBucketFilter("All")}>
              Show all items
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          {viewer.canApproveConditionReports &&
            conditionQueue.filter((r) => r.status === "pending").length > 0 && (
              <Card className="border lg:max-w-5xl" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
                <CardContent className="p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left gap-2"
                    onClick={() => setConditionPanelOpen((o) => !o)}
                  >
                    <span className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
                      Condition reports queue
                    </span>
                    <span className="text-xs font-medium rounded-full px-2 py-0.5 text-white shrink-0" style={{ backgroundColor: "#d97706" }}>
                      {conditionQueue.filter((r) => r.status === "pending").length} pending
                    </span>
                  </button>
                  {conditionPanelOpen && (
                    <ul className="mt-3 space-y-2 max-h-[min(50vh,280px)] overflow-y-auto">
                      {conditionQueue
                        .filter((r) => r.status === "pending")
                        .map((r) => (
                          <li
                            key={r.id}
                            className="rounded-md border p-3 text-sm space-y-2"
                            style={{ borderColor: "rgb(var(--border))" }}
                          >
                            <div className="font-medium" style={{ color: "rgb(var(--text))" }}>
                              {r.itemName || "Item"}
                            </div>
                            <div className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                              {r.inventoryBucket}
                              {r.equipmentType ? ` · ${r.equipmentType}` : ""}
                            </div>
                            <div>
                              <span style={{ color: "rgb(var(--text))" }}>Proposed: </span>
                              <span className="font-medium" style={getConditionColor(r.reportedCondition)}>
                                {r.reportedCondition.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                              By {r.reportedByName} · {new Date(r.createdAt).toLocaleString()}
                            </div>
                            {r.note && (
                              <p className="text-xs whitespace-pre-wrap" style={{ color: "rgb(var(--text))" }}>
                                {r.note}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                                disabled={loading || conditionActionId === r.id}
                                onClick={() => void reviewConditionReport(r.id, "approve")}
                              >
                                {conditionActionId === r.id ? "…" : "Approve"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={loading || conditionActionId === r.id}
                                onClick={() => void reviewConditionReport(r.id, "dismiss")}
                              >
                                Dismiss
                              </Button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          <div className="hidden lg:block lg:max-w-5xl">
            <PortalUnderlineTabs
              compact
              tabs={bucketTabs}
              value={bucketFilter}
              onValueChange={(id) => setBucketFilter(id as BucketFilter)}
              ariaLabel="Inventory category filter"
            />
          </div>
          <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
      {/* Left Sidebar - item types */}
      <div className="w-64 flex-shrink-0 border-r" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="p-4 border-b" style={{ borderColor: "rgb(var(--border))" }}>
          <div className="mb-3 lg:hidden">
            <PortalUnderlineTabs
              compact
              tabs={bucketTabs}
              value={bucketFilter}
              onValueChange={(id) => setBucketFilter(id as BucketFilter)}
              ariaLabel="Inventory category filter"
            />
          </div>
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
                  {permissions.canCreate && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 shrink-0 gap-1 border-2 px-2.5"
                      style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                      title="Add equipment"
                      onClick={() => setShowAddModal(true)}
                    >
                      <Plus className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="text-xs font-medium">Add</span>
                    </Button>
                  )}
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
                <div className="space-y-8">
                  {displayItemSections.map(({ bucketLabel, items: sectionItems }) => (
                    <div key={bucketLabel ?? "single-type"}>
                      {bucketLabel && (
                        <div className="mb-3 border-b pb-2" style={{ borderColor: "rgb(var(--border))" }}>
                          <p
                            className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: "rgb(var(--muted))" }}
                          >
                            {bucketLabel}
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectionItems.map((item) => {
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
                          {permissions.canAssign && isPlayerAssignableBucket(item.inventoryBucket || "Gear") && (
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
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  {displayItemSections.map(({ bucketLabel, items: sectionItems }) => (
                    <div key={`list-${bucketLabel ?? "single-type"}`}>
                      {bucketLabel && (
                        <div className="mb-2 border-b pb-2" style={{ borderColor: "rgb(var(--border))" }}>
                          <p
                            className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: "rgb(var(--muted))" }}
                          >
                            {bucketLabel}
                          </p>
                        </div>
                      )}
                      <div className="space-y-3">
                  {sectionItems.map((item) => {
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
                            {permissions.canAssign && isPlayerAssignableBucket(item.inventoryBucket || "Gear") && (
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
                    </div>
                  ))}
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
          initialInventoryBucket={bucketFilter !== "All" ? bucketFilter : undefined}
          lockInventoryBucket={bucketFilter !== "All"}
          initialEquipmentTypeLabel={activeTab ?? undefined}
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
          teamId={teamId}
          canReportCondition={viewer.canReportCondition}
          onConditionReportSubmitted={() => void onRefreshInventory()}
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
          assignedCount={groupedItems[activeTab]?.filter((item) => item.assignedToPlayerId).length || 0}
          defaultInventoryBucket={groupedItems[activeTab]?.[0]?.inventoryBucket || "Gear"}
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
