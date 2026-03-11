"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface PlayerFormsModalProps {
  player: {
    id: string
    firstName: string
    lastName: string
    missingForms?: string[]
  }
  isOpen: boolean
  onClose: () => void
  onFormsUpdate?: (playerId: string, formsComplete: boolean, missingForms: string[]) => void | Promise<void>
}

const FORM_TYPES = [
  "Player Agreement",
  "Insurance",
  "Physical Exam",
  "Liability Agreement"
]

export function PlayerFormsModal({
  player,
  isOpen,
  onClose,
  onFormsUpdate,
}: PlayerFormsModalProps) {
  const [formsComplete, setFormsComplete] = useState<boolean | null>(null)
  const [selectedMissingForms, setSelectedMissingForms] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [existingMissingForms, setExistingMissingForms] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      // Load existing missing forms when modal opens
      const missing = player.missingForms || []
      setExistingMissingForms(missing)
      setSelectedMissingForms(missing)
      // If there are missing forms, default to "Forms Missing"
      setFormsComplete(missing.length === 0 ? null : false)
    }
  }, [isOpen, player.missingForms])

  const handleFormsComplete = () => {
    setFormsComplete(true)
    setSelectedMissingForms([])
  }

  const handleFormsMissing = () => {
    setFormsComplete(false)
  }

  const toggleForm = (formType: string) => {
    setSelectedMissingForms(prev => {
      if (prev.includes(formType)) {
        return prev.filter(f => f !== formType)
      } else {
        return [...prev, formType]
      }
    })
  }

  const handleSubmit = async () => {
    if (formsComplete === null) {
      return
    }

    setLoading(true)
    try {
      if (onFormsUpdate) {
        await onFormsUpdate(
          player.id,
          formsComplete,
          formsComplete ? [] : selectedMissingForms
        )
      } else {
        // Fallback: call API directly
        const response = await fetch(`/api/roster/${player.id}/forms`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            formsComplete,
            missingForms: formsComplete ? [] : selectedMissingForms,
          }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error?.error || "Failed to update forms")
        }
      }
      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update forms")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 cursor-default"
        onClick={onClose}
        aria-label="Close modal"
        tabIndex={-1}
      />

      {/* Modal panel */}
      <div
        className="relative z-10 flex flex-col w-full max-w-md max-h-[85vh] rounded-2xl bg-white shadow-2xl border border-[#E5E7EB] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Player Forms"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-white shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#212529]">
              Forms Status
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {player.firstName} {player.lastName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6c757d] hover:bg-[#F9FAFB] hover:text-[#212529] transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Show existing missing forms if any */}
          {existingMissingForms.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm font-semibold text-orange-800 mb-2">
                Currently Missing Forms:
              </p>
              <ul className="text-sm text-orange-700 space-y-1">
                {existingMissingForms.map((form) => (
                  <li key={form} className="flex items-center">
                    <span className="mr-2">•</span>
                    {form}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 mb-4">
            <Button
              onClick={handleFormsComplete}
              className={`w-full ${
                formsComplete === true
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              }`}
            >
              Forms Complete
            </Button>
            <Button
              onClick={handleFormsMissing}
              className={`w-full ${
                formsComplete === false
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              }`}
            >
              Forms Missing
            </Button>
          </div>

          {/* Missing Forms Selection */}
          {formsComplete === false && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                Select Missing Forms:
              </Label>
              <div className="space-y-2">
                {FORM_TYPES.map((formType) => (
                  <div key={formType} className="flex items-center space-x-2">
                    <Checkbox
                      id={`form-${formType}`}
                      checked={selectedMissingForms.includes(formType)}
                      onCheckedChange={() => toggleForm(formType)}
                    />
                    <Label
                      htmlFor={`form-${formType}`}
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      {formType}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-white shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={formsComplete === null || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
