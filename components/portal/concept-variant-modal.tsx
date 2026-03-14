"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { RecommendedConcept } from "@/lib/constants/formation-concept-recommendations"
import type { ConceptVariantOption } from "@/lib/play-generation/concept-variants"

export interface ConceptVariantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  concept: RecommendedConcept
  variants: ConceptVariantOption[]
  onSelect: (variantId: string) => void
  generating?: boolean
}

export function ConceptVariantModal({
  open,
  onOpenChange,
  concept,
  variants,
  onSelect,
  generating = false,
}: ConceptVariantModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle className="text-slate-900">{concept.name}</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">Choose a variant for this concept</p>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          {variants.map((v) => (
            <Button
              key={v.id}
              variant="outline"
              className="justify-start h-10 text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              onClick={() => onSelect(v.id)}
              disabled={generating}
            >
              {generating ? "Creating…" : v.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
          <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
