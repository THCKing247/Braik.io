"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface BulkEditModalProps {
  open: boolean
  onClose: () => void
  equipmentType: string
  itemCount: number
  assignedCount?: number
  /** First line’s bucket — used as default for optional bucket change. */
  defaultInventoryBucket?: string
  onSave: (data: {
    condition?: string
    status?: string
    notes?: string
    quantity?: number
    inventoryBucket?: string
    /** Sets both equipment type and category for every line in the group. */
    equipmentType?: string
    costPerUnit?: number | null
  }) => Promise<void>
  loading?: boolean
}

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_REPAIR", "REPLACE"] as const
const AVAILABILITY_STATUSES = ["AVAILABLE", "ASSIGNED", "MISSING", "NEEDS_REPLACEMENT", "DAMAGED"] as const
const INVENTORY_BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const

export function BulkEditModal({
  open,
  onClose,
  equipmentType,
  itemCount,
  assignedCount = 0,
  defaultInventoryBucket,
  onSave,
  loading = false,
}: BulkEditModalProps) {
  const minQuantity = assignedCount
  const [condition, setCondition] = useState<typeof CONDITIONS[number] | "">("")
  const [status, setStatus] = useState<typeof AVAILABILITY_STATUSES[number] | "">("")
  const [notes, setNotes] = useState("")
  const [quantity, setQuantity] = useState<string>("")
  const [inventoryBucket, setInventoryBucket] = useState<typeof INVENTORY_BUCKETS[number] | "">("")
  const [equipmentTypeDraft, setEquipmentTypeDraft] = useState("")
  const [costPerUnit, setCostPerUnit] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate quantity if provided
    if (quantity !== "") {
      const qtyNum = parseInt(quantity, 10)
      if (isNaN(qtyNum) || qtyNum < 0) {
        alert("Quantity must be a valid number greater than or equal to 0")
        return
      }
      if (qtyNum < minQuantity) {
        alert(
          `Quantity cannot be less than ${minQuantity} (${assignedCount} item${assignedCount !== 1 ? "s are" : " is"} currently assigned). ` +
          `Please unassign items first if you need to reduce the quantity below ${minQuantity}.`
        )
        return
      }
      if (qtyNum === itemCount) {
        // No change needed
        setQuantity("")
      }
    }

    try {
      let cost: number | null | undefined = undefined
      if (costPerUnit.trim() !== "") {
        const n = parseFloat(costPerUnit)
        if (Number.isNaN(n) || n < 0) {
          alert("Unit price must be a valid number ≥ 0")
          return
        }
        cost = n
      }

      await onSave({
        condition: condition || undefined,
        status: status || undefined,
        notes: notes.trim() || undefined,
        quantity: quantity !== "" ? parseInt(quantity, 10) : undefined,
        inventoryBucket: inventoryBucket || undefined,
        equipmentType:
          equipmentTypeDraft.trim() && equipmentTypeDraft.trim() !== equipmentType
            ? equipmentTypeDraft.trim()
            : undefined,
        costPerUnit: cost !== undefined ? cost : undefined,
      })
      onClose()
    } catch (error) {
      // Error handling is done in parent component
    }
  }

  const handleClose = () => {
    if (!loading) {
      setCondition("")
      setStatus("")
      setNotes("")
      setQuantity("")
      setInventoryBucket("")
      setEquipmentTypeDraft("")
      setCostPerUnit("")
      onClose()
    }
  }

  useEffect(() => {
    if (open) {
      setEquipmentTypeDraft(equipmentType)
      const b = defaultInventoryBucket?.trim()
      setInventoryBucket(
        b && INVENTORY_BUCKETS.includes(b as (typeof INVENTORY_BUCKETS)[number])
          ? (b as (typeof INVENTORY_BUCKETS)[number])
          : ""
      )
      setCostPerUnit("")
    }
  }, [open, equipmentType, defaultInventoryBucket])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Edit All {equipmentType} Items
          </DialogTitle>
          <DialogDescription>
            Changes will apply to all {itemCount} items of this type. Leave fields empty to keep current values.
            <br />
            <span className="font-medium">Current quantity: {itemCount} items</span>
            {assignedCount > 0 && (
              <>
                <br />
                <span className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                  ({assignedCount} assigned, {itemCount - assignedCount} unassigned) • Minimum quantity: {minQuantity}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Condition */}
          <div className="space-y-2">
            <Label htmlFor="condition" style={{ color: "rgb(var(--text))" }}>
              Condition (Optional)
            </Label>
            <select
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as typeof CONDITIONS[number] | "")}
              className="w-full px-3 py-2 border rounded-md"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            >
              <option value="">Keep Current</option>
              {CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" style={{ color: "rgb(var(--text))" }}>
              Availability Status (Optional)
            </Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof AVAILABILITY_STATUSES[number] | "")}
              className="w-full px-3 py-2 border rounded-md"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            >
              <option value="">Keep Current</option>
              {AVAILABILITY_STATUSES.map((stat) => (
                <option key={stat} value={stat}>
                  {stat.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" style={{ color: "rgb(var(--text))" }}>
              Notes (Optional)
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
              placeholder="Additional notes for all items..."
            />
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              Leave empty to keep current notes, or enter new notes to replace all existing notes
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-inventory-bucket" style={{ color: "rgb(var(--text))" }}>
              Inventory category (optional)
            </Label>
            <select
              id="bulk-inventory-bucket"
              value={inventoryBucket}
              onChange={(e) =>
                setInventoryBucket(e.target.value as typeof INVENTORY_BUCKETS[number] | "")
              }
              className="w-full px-3 py-2 border rounded-md"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            >
              <option value="">Keep current</option>
              {INVENTORY_BUCKETS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-equipment-type" style={{ color: "rgb(var(--text))" }}>
              Equipment type / category label (optional)
            </Label>
            <Input
              id="bulk-equipment-type"
              value={equipmentTypeDraft}
              onChange={(e) => setEquipmentTypeDraft(e.target.value)}
              placeholder={equipmentType}
              className="w-full"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            />
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              Change only if you want every line in this group to use a new type label; leave as-is otherwise.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-cost-per-unit" style={{ color: "rgb(var(--text))" }}>
              Unit price — all lines (optional)
            </Label>
            <Input
              id="bulk-cost-per-unit"
              type="number"
              min={0}
              step="0.01"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              placeholder="e.g. 24.99"
              className="w-full"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
            />
          </div>

          {/* Quantity Adjustment */}
          <div className="space-y-2 border-t pt-4" style={{ borderTopColor: "rgb(var(--border))" }}>
            <Label htmlFor="quantity" style={{ color: "rgb(var(--text))" }}>
              Adjust Total Quantity (Optional)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="quantity"
                type="number"
                min={minQuantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={itemCount.toString()}
                className="flex-1"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))",
                  color: "rgb(var(--text))",
                }}
              />
              <span className="text-sm whitespace-nowrap" style={{ color: "rgb(var(--muted))" }}>
                items
              </span>
            </div>
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              Enter the new total quantity. {minQuantity > 0 && `Minimum: ${minQuantity} (${assignedCount} assigned). `}
              The system will {quantity && parseInt(quantity, 10) > itemCount 
                ? `add ${parseInt(quantity, 10) - itemCount} item${parseInt(quantity, 10) - itemCount !== 1 ? "s" : ""}`
                : quantity && parseInt(quantity, 10) < itemCount
                ? `remove ${itemCount - parseInt(quantity, 10)} item${itemCount - parseInt(quantity, 10) !== 1 ? "s" : ""} (only unassigned items will be removed)`
                : "automatically add or remove items to match the quantity"}
              {quantity && parseInt(quantity, 10) === itemCount && " (no change)"}
            </p>
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
              {loading ? "Updating..." : `Update All ${itemCount} Items`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
