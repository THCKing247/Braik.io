"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const tabButtonClassNormal =
  "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium rounded-t transition-[border-color,color,background-color] duration-200 ease-out"
const tabButtonClassCompact =
  "whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium rounded-t transition-[border-color,color,background-color] duration-200 ease-out"

export type PortalUnderlineTab = {
  id: string
  label: React.ReactNode
  /** Optional DOM id for the tab button (a11y). */
  tabId?: string
  /** Optional panel id for aria-controls. */
  panelId?: string
}

type PortalUnderlineTabsProps = {
  tabs: PortalUnderlineTab[]
  value: string
  onValueChange: (id: string) => void
  ariaLabel?: string
  className?: string
  navClassName?: string
  /** Tighter padding for secondary bars (e.g. filter row). */
  compact?: boolean
  /**
   * Stronger active tab (thicker underline, semibold) — e.g. Inventory Items / Expenses.
   * Keeps the same underline pattern as the rest of the portal, more pronounced.
   */
  emphasized?: boolean
}

/**
 * Text tabs with bottom underline for the active item — matches Player Profile nav
 * (`player-profile-view.tsx`) and keeps motion consistent across portal surfaces.
 */
export function PortalUnderlineTabs({
  tabs,
  value,
  onValueChange,
  ariaLabel = "Sections",
  className,
  navClassName,
  compact = false,
  emphasized = false,
}: PortalUnderlineTabsProps) {
  const tabBtn = compact ? tabButtonClassCompact : tabButtonClassNormal
  const activeStrong = emphasized && !compact
  return (
    <div className={cn("border-b border-[#E5E7EB] -mx-2 px-2 sm:mx-0 sm:px-0", className)}>
      <nav
        className={cn("flex gap-1 overflow-x-auto pb-px scrollbar-thin", navClassName)}
        aria-label={ariaLabel}
        role="tablist"
      >
        {tabs.map((tab) => {
          const active = value === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tab.tabId}
              aria-selected={active}
              aria-controls={tab.panelId}
              onClick={() => onValueChange(tab.id)}
              className={cn(
                tabBtn,
                activeStrong && "px-4 py-3.5",
                active
                  ? activeStrong
                    ? "border-b-[3px] border-[#0B2A5B] font-semibold text-[#0F172A] bg-[#EFF6FF] shadow-sm"
                    : "border-[#0B2A5B] text-[#0F172A] bg-[#F8FAFC]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]/50"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
