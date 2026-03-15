"use client"

import { useState, useEffect } from "react"
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
}

interface EditItemModalProps {
  open: boolean
  onClose: () => void
  item: InventoryItem | null
  players: Player[]
  onSave: (data: {
    condition: string
    status: string
    assignedToPlayerId?: string | null
    notes?: string
    size?: string
    make?: string
  }) => Promise<void>
  loading?: boolean
}

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_REPAIR", "REPLACE"] as const
const AVAILABILITY_STATUSES = ["AVAILABLE", "ASSIGNED", "MISSING", "NEEDS_REPLACEMENT", "DAMAGED"] as const

export function EditItemModal({
  open,
  onClose,
  item,
  players,
  onSave,
  loading = false,
}: EditItemModalProps) {
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>("GOOD")
  const [availability, setAvailability] = useState<typeof AVAILABILITY_STATUSES[number]>("AVAILABLE")
  const [assignedToPlayerId, setAssignedToPlayerId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [size, setSize] = useState("")
  const [make, setMake] = useState("")

  useEffect(() => {
    if (item) {
      setCondition((item.condition as typeof CONDITIONS[number]) || "GOOD")
      setAvailability((item.status as typeof AVAILABILITY_STATUSES[number]) || "AVAILABLE")
      setAssignedToPlayerId(item.assignedToPlayerId || "")
      setNotes(item.notes || "")
      setSize(item.size || "")
      setMake(item.make || "")
    }
  }, [item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!item) return

    try {
      await onSave({
        condition,
        status: availability,
        assignedToPlayerId: assignedToPlayerId || null,
        notes: notes.trim() || undefined,
        size: size.trim() || undefined,
        make: make.trim() || undefined,
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

          {/* Assign to Player */}
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
