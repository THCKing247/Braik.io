"use client"

import { useMemo, useState } from "react"
import { Lightbulb, FilePlus, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { detectFormationFamily } from "@/lib/utils/formation-family"
import {
  getConceptsByFamily,
  getFormationFamilyConfig,
  type RecommendedConcept,
} from "@/lib/constants/formation-concept-recommendations"
import { rankConcepts, type RankedConcept } from "@/lib/utils/formation-concept-ranking"
import { getConceptVariants, hasMultipleVariants } from "@/lib/play-generation/concept-variants"
import { ConceptVariantModal } from "@/components/portal/concept-variant-modal"

export interface FormationIntelligencePanelProps {
  /** Formation display name */
  formationName?: string | null
  /** Sub-formation display name (when viewing a sub-formation) */
  subFormationName?: string | null
  /** Optional template id if available (e.g. from creation flow) */
  templateId?: string | null
  /** Plays in this formation/sub-formation (or playbook) to rank concepts by usage */
  plays?: { name: string; tags?: string[] | null }[] | null
  /** Called when user clicks Generate Draft. Second arg is variant id when concept has variants. */
  onGenerateDraft?: (concept: RecommendedConcept, variantId?: string) => void | Promise<void>
  /** Optional: called when user clicks View Details for a concept */
  onViewDetails?: (concept: RecommendedConcept) => void
  /** Currently selected concept for persistent preview in formation panel */
  selectedConcept?: RecommendedConcept | null
  /** Called when user hovers a concept (temporary preview) */
  onConceptHover?: (concept: RecommendedConcept | null) => void
  /** Called when user clicks a concept row to select it for persistent preview */
  onConceptSelect?: (concept: RecommendedConcept | null) => void
  /** Called when user clears the selected concept preview */
  onClearPreview?: () => void
  className?: string
}

function ConceptRow({
  ranked,
  isSelected,
  onGenerateDraft,
  onViewDetails,
  onRequestVariantModal,
  onHover,
  onSelect,
}: {
  ranked: RankedConcept
  isSelected?: boolean
  onGenerateDraft?: (concept: RecommendedConcept, variantId?: string) => void | Promise<void>
  onViewDetails?: (concept: RecommendedConcept) => void
  onRequestVariantModal?: (concept: RecommendedConcept) => void
  onHover?: (concept: RecommendedConcept | null) => void
  onSelect?: (concept: RecommendedConcept | null) => void
}) {
  const { concept } = ranked
  const [generating, setGenerating] = useState(false)
  const variants = useMemo(() => getConceptVariants(concept.name), [concept.name])
  const showVariantModal = variants != null && hasMultipleVariants(concept.name)

  const handleGenerate = async (variantId?: string) => {
    if (!onGenerateDraft || generating) return
    if (showVariantModal && variantId === undefined) {
      onRequestVariantModal?.(concept)
      return
    }
    setGenerating(true)
    try {
      await onGenerateDraft(concept, variantId)
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateClick = () => {
    if (showVariantModal) onRequestVariantModal?.(concept)
    else void handleGenerate()
  }

  const handleRowClick = () => {
    if (onSelect) onSelect(isSelected ? null : concept)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect ? handleRowClick : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRowClick(); } } : undefined}
      onMouseEnter={() => onHover?.(concept)}
      onMouseLeave={() => onHover?.(null)}
      className={`flex flex-col gap-2 py-2 px-3 rounded-lg border transition-colors ${
        isSelected
          ? "bg-slate-100 border-slate-500 ring-2 ring-slate-400 shadow-sm"
          : "bg-slate-50/80 border-slate-100 hover:border-slate-200"
      } ${onSelect ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-medium text-sm ${isSelected ? "text-slate-900" : "text-slate-800"}`}>{concept.name}</span>
        {concept.category && (
          <span className={`text-xs shrink-0 ${isSelected ? "text-slate-600" : "text-slate-500"}`}>{concept.category}</span>
        )}
      </div>
      {ranked.hint && (
        <p className="text-xs text-slate-500 mt-0.5" title={ranked.playCount != null ? `${ranked.playCount} play(s) in playbook` : undefined}>
          {ranked.hint}
        </p>
      )}
      {(onGenerateDraft || onViewDetails) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
          {onGenerateDraft && (
            <Button
              size="sm"
              variant="default"
              className={`h-7 text-xs ${isSelected ? "font-semibold" : ""}`}
              onClick={handleGenerateClick}
              disabled={generating}
            >
              <FilePlus className="h-3 w-3 mr-1" />
              {generating ? "Creating…" : isSelected ? "Generate draft from this concept" : "Generate Draft"}
            </Button>
          )}
          {onViewDetails && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-slate-600"
              onClick={() => onViewDetails(concept)}
            >
              <Info className="h-3 w-3 mr-1" />
              View Details
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function FormationIntelligencePanel({
  formationName,
  subFormationName,
  templateId,
  plays,
  onGenerateDraft,
  onViewDetails,
  selectedConcept = null,
  onConceptHover,
  onConceptSelect,
  onClearPreview,
  className = "",
}: FormationIntelligencePanelProps) {
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [conceptForVariant, setConceptForVariant] = useState<RecommendedConcept | null>(null)
  const [generatingFromModal, setGeneratingFromModal] = useState(false)

  const variantOptions = useMemo(
    () => (conceptForVariant ? getConceptVariants(conceptForVariant.name) : null),
    [conceptForVariant]
  )

  const handleRequestVariantModal = (concept: RecommendedConcept) => {
    setConceptForVariant(concept)
    setVariantModalOpen(true)
  }

  const handleVariantSelect = async (variantId: string) => {
    if (!conceptForVariant || !onGenerateDraft) return
    setGeneratingFromModal(true)
    try {
      await onGenerateDraft(conceptForVariant, variantId)
      setVariantModalOpen(false)
      setConceptForVariant(null)
    } finally {
      setGeneratingFromModal(false)
    }
  }

  const { familyLabel, rankedConcepts } = useMemo(() => {
    const id = detectFormationFamily({
      formationName,
      subFormationName,
      templateId,
    })
    if (!id) {
      return { familyLabel: null, rankedConcepts: [] as RankedConcept[] }
    }
    const config = getFormationFamilyConfig(id)
    const familyLabel = config?.label ?? id
    const concepts = getConceptsByFamily(id)
    const playList = Array.isArray(plays) ? plays : []
    const rankedConcepts = rankConcepts(concepts, playList, familyLabel)
    return { familyLabel, rankedConcepts }
  }, [formationName, subFormationName, templateId, plays])

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}
      data-formation-intelligence
    >
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Lightbulb className="h-5 w-5 text-slate-500 shrink-0" />
            <h3 className="font-semibold text-slate-900">Suggested Concepts</h3>
          </div>
          {selectedConcept && onClearPreview && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClearPreview(); }}
              className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-1 shrink-0"
            >
              Clear preview
            </button>
          )}
        </div>
        {familyLabel && (
          <p className="text-xs text-slate-600 mt-1">
            Based on <span className="font-medium text-slate-700">{familyLabel}</span> alignment
          </p>
        )}
      </div>
      <div className="p-3">
        {rankedConcepts.length === 0 ? (
          <div className="py-6 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
            <p className="text-sm text-slate-500">No suggested concepts for this formation.</p>
            <p className="text-xs text-slate-400 mt-1">
              Add a formation name or sub-formation name that matches a known family (e.g. Trips, Bunch, Pistol).
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rankedConcepts.map((ranked, i) => (
              <li key={`${ranked.concept.name}-${i}`}>
                <ConceptRow
                  ranked={ranked}
                  isSelected={selectedConcept?.name === ranked.concept.name}
                  onGenerateDraft={onGenerateDraft}
                  onViewDetails={onViewDetails}
                  onRequestVariantModal={onGenerateDraft ? handleRequestVariantModal : undefined}
                  onHover={onConceptHover}
                  onSelect={onConceptSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {conceptForVariant && variantOptions && (
        <ConceptVariantModal
          open={variantModalOpen}
          onOpenChange={(open) => {
            setVariantModalOpen(open)
            if (!open) setConceptForVariant(null)
          }}
          concept={conceptForVariant}
          variants={variantOptions}
          onSelect={handleVariantSelect}
          generating={generatingFromModal}
        />
      )}
    </div>
  )
}
