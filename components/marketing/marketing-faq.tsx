"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export type MarketingFaqItem = { q: string; a: ReactNode }

export function MarketingFaq({
  title,
  subtitle,
  items,
  defaultOpenIndex = 0,
}: {
  title: string
  subtitle?: string
  items: MarketingFaqItem[]
  defaultOpenIndex?: number | null
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex ?? 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-2">
          {title}
        </h2>
        {subtitle ? <p className="text-[#212529]/80">{subtitle}</p> : null}
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={item.q}
            className={cn(
              "rounded-xl border border-slate-200/90 bg-white overflow-hidden transition-all",
              openIndex === i && "border-[#3B82F6]/40 shadow-md ring-1 ring-[#3B82F6]/10"
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 py-4 px-5 text-left"
              aria-expanded={openIndex === i}
            >
              <span className="font-semibold text-[#212529]">{item.q}</span>
              <span
                className={cn(
                  "text-[#3B82F6] text-xl font-bold transition-transform shrink-0",
                  openIndex === i && "rotate-45"
                )}
                aria-hidden
              >
                +
              </span>
            </button>
            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                openIndex === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <div className="pb-4 px-5 pt-0 text-[#212529]/85 leading-relaxed border-t border-slate-100">
                  <div className="pt-3 [&_p]:mb-0">{item.a}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
