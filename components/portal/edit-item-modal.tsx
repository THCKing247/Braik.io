"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isPlayerAssignableBucket } from "@/lib/inventory-category-policy"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber?: number | null
}

interface InventoryItem {
  id: string
  category: string
  name: string
  condition: string
  status: string
  assignedToPlayerId?: string | null
  equipmentType?: string | null
  notes?: string | null
  size?: string | null
  make?: string | null
  itemCode?: string | null
  quantityTotal?: number
  quantityAvailable?: number
  inventoryBucket?: string
  costPerUnit?: number | null
  costNotes?: string | null
  costUpdatedAt?: string | null
  damageReportText?: string | null
  damageReportedAt?: string | null
}

const REPORT_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "NEEDS_REPLACEMENT"] as const

interface EditItemModalProps {
  open: boolean
  onClose: () => void
  item: InventoryItem | null
  players: Player[]
  teamId?: string
  canReportCondition?: boolean
  onConditionReportSubmitted?: () => void
  onSave: (data: {
    condition: string
    status: string
    assignedToPlayerId?: string | null
    notes?: string
    size?: string
    make?: string
    quantityTotal?: number
    quantityAvailable?: number
    itemCode: string
    inventoryBucket: string
    costPerUnit: number | null
    costNotes: string
    clearDamageReport?: boolean
  }) => Promise<void>
  loading?: boolean
}

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_REPAIR", "REPLACE"] as const
const AVAILABILITY_STATUSES = ["AVAILABLE", "ASSIGNED", "MISSING", "NEEDS_REPLACEMENT", "DAMAGED"] as const
const INVENTORY_BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const

export function EditItemModal({
  open,
  onClose,
  item,
  players,
  teamId,
  canReportCondition = false,
  onConditionReportSubmitted,
  onSave,
  loading = false,
}: EditItemModalProps) {
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>("GOOD")
  const [availability, setAvailability] = useState<typeof AVAILABILITY_STATUSES[number]>("AVAILABLE")
  const [assignedToPlayerId, setAssignedToPlayerId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [size, setSize] = useState("")
  const [make, setMake] = useState("")
  const [quantityTotal, setQuantityTotal] = useState<string>("1")
  const [quantityAvailable, setQuantityAvailable] = useState<string>("0")
  const [itemCode, setItemCode] = useState("")
  const [inventoryBucket, setInventoryBucket] = useState<string>(INVENTORY_BUCKETS[0])
  const [costPerUnit, setCostPerUnit] = useState("")
  const [costNotes, setCostNotes] = useState("")
  const [clearDamageReport, setClearDamageReport] = useState(false)
  const [reportCondition, setReportCondition] = useState<(typeof REPORT_CONDITIONS)[number]>("GOOD")
  const [reportNote, setReportNote] = useState("")
  const [reportSubmitting, setReportSubmitting] = useState(false)

  useEffect(() => {
    if (item) {
      setCondition((item.condition as typeof CONDITIONS[number]) || "GOOD")
      setAvailability((item.status as typeof AVAILABILITY_STATUSES[number]) || "AVAILABLE")
      setAssignedToPlayerId(item.assignedToPlayerId || "")
      setNotes(item.notes || "")
      setSize(item.size || "")
      setMake(item.make || "")
      setQuantityTotal(item.quantityTotal?.toString() || "1")
      setQuantityAvailable(item.quantityAvailable?.toString() || "0")
      setItemCode(item.itemCode || "")
      setInventoryBucket(
        INVENTORY_BUCKETS.includes((item.inventoryBucket || "") as (typeof INVENTORY_BUCKETS)[number])
          ? (item.inventoryBucket as (typeof INVENTORY_BUCKETS)[number])
          : INVENTORY_BUCKETS[0]
      )
      setCostPerUnit(
        item.costPerUnit != null && !Number.isNaN(item.costPerUnit) ? String(item.costPerUnit) : ""
      )
      setCostNotes(item.costNotes || "")
      setClearDamageReport(false)
      setReportNote("")
      setReportCondition("GOOD")
    }
  }, [item])

  const submitConditionReport = async () => {
    if (!item || !teamId) return
    setReportSubmitting(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/inventory/condition-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          reportedCondition: reportCondition,
          note: reportNote.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? "Could not submit report")
      }
      setReportNote("")
      onConditionReportSubmitted?.()
      alert("Condition report submitted for head coach review.")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not submit report")
    } finally {
      setReportSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!item) return

    try {
      const qtyTotal = parseInt(quantityTotal, 10)
      const qtyAvailable = parseInt(quantityAvailable, 10)
      
      if (isNaN(qtyTotal) || qtyTotal < 0) {
        alert("Total quantity must be a valid number greater than or equal to 0")
        return
      }
      
      if (isNaN(qtyAvailable) || qtyAvailable < 0) {
        alert("Available quantity must be a valid number greater than or equal to 0")
        return
      }
      
      if (qtyAvailable > qtyTotal) {
        alert("Available quantity cannot exceed total quantity")
        return
      }

      const costRaw = costPerUnit.trim()
      const costNum = costRaw === "" ? null : Number(costRaw)
      await onSave({
        condition,
        status: availability,
        assignedToPlayerId: assignedToPlayerId || null,
        notes: notes.trim() || undefined,
        size: size.trim() || undefined,
        make: make.trim() || undefined,
        quantityTotal: qtyTotal,
        quantityAvailable: qtyAvailable,
        itemCode: itemCode.trim(),
        inventoryBucket,
        costPerUnit: costNum !== null && !Number.isNaN(costNum) && costNum >= 0 ? costNum : null,
        costNotes: costNotes.trim(),
        clearDamageReport: clearDamageReport || undefined,
      })

      onClose()
    } catch (error) {
      // Error handling is done in parent component
    }
  }

  const handleClose = () => {
    if (!loading && item) {
      setCondition((item.condition as typeof CONDITIONS[number]) || "GOOD")
      setAvailability((item.status as typeof AVAILABILITY_STATUSES[number]) || "AVAILABLE")
      setAssignedToPlayerId(item.assignedToPlayerId || "")
      setNotes(item.notes || "")
      setSize(item.size || "")
      setMake(item.make || "")
      setQuantityTotal(item.quantityTotal?.toString() || "1")
      setQuantityAvailable(item.quantityAvailable?.toString() || "0")
      setItemCode(item.itemCode || "")
      setInventoryBucket(
        INVENTORY_BUCKETS.includes((item.inventoryBucket || "") as (typeof INVENTORY_BUCKETS)[number])
          ? (item.inventoryBucket as (typeof INVENTORY_BUCKETS)[number])
          : INVENTORY_BUCKETS[0]
      )
      setCostPerUnit(
        item.costPerUnit != null && !Number.isNaN(item.costPerUnit) ? String(item.costPerUnit) : ""
      )
      setCostNotes(item.costNotes || "")
      setClearDamageReport(false)
      onClose()
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Edit Equipment Item
          </DialogTitle>
          <DialogDescription>
            Update equipment details for: {item.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Equipment Info (Read-only) */}
          <div className="space-y-2">
            <Label style={{ color: "rgb(var(--text))" }}>Equipment Type</Label>
            <Input
              value={item.equipmentType || item.category}
              disabled
              style={{
                backgroundColor: "rgb(var(--platinum))",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--muted))",
              }}
            />
          </div>

          <div className="space-y-2">
            <Label style={{ color: "rgb(var(--text))" }}>Item Name</Label>
            <Input
              value={item.name}
              disabled
              style={{
                backgroundColor: "rgb(var(--platinum))",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--muted))",
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invBucket" style={{ color: "rgb(var(--text))" }}>
                Inventory category *
              </Label>
              <select
                id="invBucket"
                value={inventoryBucket}
                onChange={(e) => setInventoryBucket(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              >
                {INVENTORY_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemCode" style={{ color: "rgb(var(--text))" }}>
                Item code
              </Label>
              <Input
                id="itemCode"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="Unique label for this item"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="costPu" style={{ color: "rgb(var(--text))" }}>
                Cost per unit
              </Label>
              <Input
                id="costPu"
                type="number"
                min="0"
                step="0.01"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                placeholder="0.00"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              />
              {item.costUpdatedAt && (
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  Last cost update: {new Date(item.costUpdatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="costNotes" style={{ color: "rgb(var(--text))" }}>
                Cost notes (optional)
              </Label>
              <textarea
                id="costNotes"
                value={costNotes}
                onChange={(e) => setCostNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-md min-h-[72px] resize-none"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
                placeholder="e.g. vendor, purchase order, replacement plan"
              />
            </div>
          </div>

          {item.damageReportText && (
            <div
              className="space-y-2 rounded-md border p-3"
              style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--platinum))" }}
            >
              <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                Damage report (player)
              </p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "rgb(var(--text))" }}>
                {item.damageReportText}
              </p>
              {item.damageReportedAt && (
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  Reported {new Date(item.damageReportedAt).toLocaleString()}
                </p>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearDamageReport}
                  onChange={(e) => setClearDamageReport(e.target.checked)}
                />
                Clear player damage report
              </label>
            </div>
          )}

          {/* Size and Make */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="size" style={{ color: "rgb(var(--text))" }}>
                Size
              </Label>
              <Input
                id="size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g., Small, Medium, Large, XL"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="make" style={{ color: "rgb(var(--text))" }}>
                Make / Brand
              </Label>
              <Input
                id="make"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g., Riddell, Schutt, Nike"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              />
            </div>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantityTotal" style={{ color: "rgb(var(--text))" }}>
                Total Quantity *
              </Label>
              <Input
                id="quantityTotal"
                type="number"
                min="0"
                value={quantityTotal}
                onChange={(e) => setQuantityTotal(e.target.value)}
                placeholder="Total amount"
                required
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantityAvailable" style={{ color: "rgb(var(--text))" }}>
                Available Quantity *
              </Label>
              <Input
                id="quantityAvailable"
                type="number"
                min="0"
                value={quantityAvailable}
                onChange={(e) => setQuantityAvailable(e.target.value)}
                placeholder="Available amount"
                required
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              />
            </div>
          </div>

          {/* Condition and Availability */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="condition" style={{ color: "rgb(var(--text))" }}>
                Condition *
              </Label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as typeof CONDITIONS[number])}
                className="w-full px-3 py-2 border rounded-md"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
                required
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="availability" style={{ color: "rgb(var(--text))" }}>
                Availability Status *
              </Label>
              <select
                id="availability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value as typeof AVAILABILITY_STATUSES[number])}
                className="w-full px-3 py-2 border rounded-md"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
                required
              >
                {AVAILABILITY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign to Player — Gear & Uniforms only */}
          {isPlayerAssignableBucket(inventoryBucket) ? (
            <div className="space-y-2">
              <Label htmlFor="assignedToPlayer" style={{ color: "rgb(var(--text))" }}>
                Assign to Player
              </Label>
              <select
                id="assignedToPlayer"
                value={assignedToPlayerId}
                onChange={(e) => setAssignedToPlayerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              >
                <option value="">None - Keep in inventory</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.firstName} {player.lastName}
                    {player.jerseyNumber ? ` (#${player.jerseyNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm rounded-md border px-3 py-2" style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--muted))" }}>
              Program inventory items are not assigned to players. Use quantity and condition to track this asset.
            </p>
          )}

          {canReportCondition && teamId && item && (
            <div
              className="space-y-3 rounded-md border p-4"
              style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--platinum))" }}
            >
              <p className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
                Report condition (pending head coach review)
              </p>
              <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                Submit a proposed condition change. The varsity head coach approves or dismisses each report.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Reported condition</Label>
                  <select
                    value={reportCondition}
                    onChange={(e) => setReportCondition(e.target.value as (typeof REPORT_CONDITIONS)[number])}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "rgb(var(--border))",
                      color: "rgb(var(--text))",
                    }}
                  >
                    {REPORT_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Note (optional)</Label>
                  <textarea
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md min-h-[72px] text-sm resize-none"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "rgb(var(--border))",
                      color: "rgb(var(--text))",
                    }}
                    placeholder="Context for the head coach…"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={reportSubmitting || loading}
                onClick={() => void submitConditionReport()}
              >
                {reportSubmitting ? "Submitting…" : "Submit condition report"}
              </Button>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" style={{ color: "rgb(var(--text))" }}>
              Notes
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-md min-h-[80px] resize-none"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
              placeholder="Additional notes about this equipment..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: "rgb(var(--border))" }}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              style={{
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
