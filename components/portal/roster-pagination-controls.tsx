"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export const ROSTER_CARDS_PAGE_SIZE = 12

type RosterPaginationControlsProps = {
  page: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

export function RosterPaginationControls({
  page,
  totalItems,
  pageSize,
  onPageChange,
  className = "",
}: RosterPaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalItems)

  if (totalItems === 0) return null

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-white/80 px-4 py-3 ${className}`}
      role="navigation"
      aria-label="Roster pagination"
    >
      <p className="text-sm text-muted-foreground">
        <span className="text-foreground font-medium">{totalItems}</span> player{totalItems === 1 ? "" : "s"}
        {totalPages > 1 ? (
          <>
            {" "}
            · Showing {start}–{end} · Page {safePage} of {totalPages}
          </>
        ) : (
          <> · Page 1 of 1</>
        )}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
