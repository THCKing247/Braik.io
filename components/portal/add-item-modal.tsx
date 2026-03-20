"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber?: number | null
}

interface AddItemModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
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
  players: Player[]
  loading?: boolean
}

const EQUIPMENT_PRESETS = [
  "Helmets",
  "Pads",
  "Practice Jerseys",
  "Home Jersey",
  "Away Jersey",
  "Alternate Jersey",
  "Home Pants",
  "Away Pants",
  "Alternate Pants",
  "Practice Pants",
  "Chinstraps",
  "Knee Pads",
  "Mouthpieces",
  "Locks",
  "Lockers",
  "Playcall Wristbands",
] as const

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_REPAIR", "REPLACE"] as const
const AVAILABILITY_STATUSES = ["AVAILABLE", "ASSIGNED", "MISSING", "NEEDS_REPLACEMENT", "DAMAGED"] as const
const INVENTORY_BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const

export function AddItemModal({
  open,
  onClose,
  onSubmit,
  players,
  loading = false,
}: AddItemModalProps) {
  const [equipmentType, setEquipmentType] = useState<"preset" | "custom">("preset")
  const [selectedPreset, setSelectedPreset] = useState<string>("")
  const [customEquipmentName, setCustomEquipmentName] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>("GOOD")
  const [availability, setAvailability] = useState<typeof AVAILABILITY_STATUSES[number]>("AVAILABLE")
  const [assignedToPlayerId, setAssignedToPlayerId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [inventoryBucket, setInventoryBucket] = useState<string>(INVENTORY_BUCKETS[0])
  const [costPerUnit, setCostPerUnit] = useState("")
  const [itemCode, setItemCode] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (equipmentType === "preset" && !selectedPreset) {
      alert("Please select an equipment type")
      return
    }

    if (equipmentType === "custom" && !customEquipmentName.trim()) {
      alert("Please enter a custom equipment name")
      return
    }

    if (!quantity || parseInt(quantity) < 1) {
      alert("Please enter a valid quantity (at least 1)")
      return
    }

    try {
      const qty = parseInt(quantity, 10)
      const costRaw = costPerUnit.trim()
      const costNum = costRaw === "" ? null : Number(costRaw)
      await onSubmit({
        equipmentType: equipmentType === "preset" ? selectedPreset : "CUSTOM",
        customEquipmentName: equipmentType === "custom" ? customEquipmentName.trim() : undefined,
        quantity: qty,
        condition,
        availability,
        assignedToPlayerId: assignedToPlayerId || null,
        notes: notes.trim() || undefined,
        inventoryBucket,
        costPerUnit: costNum !== null && !Number.isNaN(costNum) && costNum >= 0 ? costNum : null,
        itemCode: qty === 1 && itemCode.trim() ? itemCode.trim() : undefined,
      })

      // Reset form
      setEquipmentType("preset")
      setSelectedPreset("")
      setCustomEquipmentName("")
      setQuantity("1")
      setCondition("GOOD")
      setAvailability("AVAILABLE")
      setAssignedToPlayerId("")
      setNotes("")
      setInventoryBucket(INVENTORY_BUCKETS[0])
      setCostPerUnit("")
      setItemCode("")
      onClose()
    } catch (error) {
      // Error handling is done in parent component
    }
  }

  const handleClose = () => {
    if (!loading) {
      setEquipmentType("preset")
      setSelectedPreset("")
      setCustomEquipmentName("")
      setQuantity("1")
      setCondition("GOOD")
      setAvailability("AVAILABLE")
      setAssignedToPlayerId("")
      setNotes("")
      setInventoryBucket(INVENTORY_BUCKETS[0])
      setCostPerUnit("")
      setItemCode("")
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Add Equipment Item
          </DialogTitle>
          <DialogDescription>
            Add equipment to your inventory. Choose from presets or create a custom item.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Equipment Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold" style={{ color: "rgb(var(--text))" }}>
              Equipment Type *
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="equipmentType"
                  value="preset"
                  checked={equipmentType === "preset"}
                  onChange={(e) => setEquipmentType(e.target.value as "preset" | "custom")}
                  className="h-4 w-4"
                  style={{ accentColor: "rgb(var(--accent))" }}
                />
                <span style={{ color: "rgb(var(--text))" }}>Preset Equipment</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="equipmentType"
                  value="custom"
                  checked={equipmentType === "custom"}
                  onChange={(e) => setEquipmentType(e.target.value as "preset" | "custom")}
                  className="h-4 w-4"
                  style={{ accentColor: "rgb(var(--accent))" }}
                />
                <span style={{ color: "rgb(var(--text))" }}>Custom Equipment</span>
              </label>
            </div>

            {equipmentType === "preset" ? (
              <div className="space-y-2">
                <Label htmlFor="presetSelect" style={{ color: "rgb(var(--text))" }}>
                  Select Equipment *
                </Label>
                <select
                  id="presetSelect"
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                  required
                >
                  <option value="">-- Select Equipment --</option>
                  {EQUIPMENT_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="customEquipment" style={{ color: "rgb(var(--text))" }}>
                  Custom Equipment Name *
                </Label>
                <Input
                  id="customEquipment"
                  value={customEquipmentName}
                  onChange={(e) => setCustomEquipmentName(e.target.value)}
                  placeholder="Enter custom equipment name"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                  required
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inventoryBucket" style={{ color: "rgb(var(--text))" }}>
              Inventory category *
            </Label>
            <select
              id="inventoryBucket"
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
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              Used for filters and expense rollups (Gear, Uniforms, etc.)
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="costPerUnit" style={{ color: "rgb(var(--text))" }}>
                Cost per unit (optional)
              </Label>
              <Input
                id="costPerUnit"
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
            </div>
            {parseInt(quantity, 10) === 1 && (
              <div className="space-y-2">
                <Label htmlFor="itemCode" style={{ color: "rgb(var(--text))" }}>
                  Item code (optional)
                </Label>
                <Input
                  id="itemCode"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity" style={{ color: "rgb(var(--text))" }}>
              Quantity *
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="How many items?"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "rgb(var(--border))",
                color: "rgb(var(--text))",
              }}
              required
            />
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              Enter the total number of items you're adding to inventory
            </p>
          </div>

          {/* Condition and Availability */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="condition" style={{ color: "rgb(var(--text))" }}>
                Baseline Condition *
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

          {/* Assign to Player (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="assignedToPlayer" style={{ color: "rgb(var(--text))" }}>
              Assign to Player (Optional)
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
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              You can assign items to players later from the inventory list
            </p>
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
              {loading ? "Adding..." : "Add Equipment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
