"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { MarketingFaqEntry } from "@/lib/marketing/faq-content"

export function MarketingFaqAccordion({
  entries,
  className,
}: {
  entries: MarketingFaqEntry[]
  className?: string
}) {
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null)

  return (
    <div className={cn("space-y-2", className)}>
      {entries.map((item) => {
        const open = openId === item.id
        return (
          <div
            key={item.id}
            className={cn(
              "rounded-xl border border-slate-200/90 bg-white overflow-hidden transition-all",
              open && "border-[#3B82F6]/40 shadow-md ring-1 ring-[#3B82F6]/10"
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 py-4 px-5 text-left"
              aria-expanded={open}
            >
              <span className="font-semibold text-[#212529]">{item.question}</span>
              <span
                className={cn(
                  "text-[#3B82F6] text-xl font-bold transition-transform shrink-0",
                  open && "rotate-45"
                )}
              >
                +
              </span>
            </button>
            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <div className="space-y-3 border-t border-slate-100 pb-4 px-5 pt-3 text-[#212529]/85 leading-relaxed text-sm">
                  <p>{item.answer}</p>
                  {item.learnMoreHref && item.learnMoreLabel ? (
                    <p>
                      <Link
                        href={item.learnMoreHref}
                        className="font-medium text-[#2563EB] hover:underline"
                      >
                        {item.learnMoreLabel}
                      </Link>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
