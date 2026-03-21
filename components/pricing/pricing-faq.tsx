"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"

const FAQ_ITEMS = [
  {
    q: "How much does Braik cost?",
    a: "Plans are annual: Head Coach (varsity + optional JV/Freshman add-ons and roster-based spots) or Athletic Director (flat department-wide). Use the calculator on this page for an estimate. Player accounts are included.",
    linkHref: "#how-much-braik-costs",
    linkLabel: "Jump to plan details",
  },
  {
    q: "Is Braik billed monthly or annually?",
    a: "Braik is billed annually. The Head Coach plan and Athletic Director plan are both paid once per year by the program or athletic department, which simplifies budgeting and aligns with typical planning cycles.",
  },
  {
    q: "Who pays for Braik—the coach or the players?",
    a: "The head coach or program pays for the Head Coach plan; the athletic department pays for the Athletic Director plan. Player accounts are included in the plan—players do not pay for their own accounts.",
  },
  {
    q: "How many assistant coaches are included?",
    a: "Head Coach plan: 3 assistants are included for varsity only. If you add a JV team, you get 1 more free assistant (4 total). If you add Freshman as well, you get 5 free assistants. Any assistants beyond that are $10 each. Athletic Director plan includes unlimited assistants.",
  },
  {
    q: "What happens if our roster grows?",
    a: "On the Head Coach plan, roster spots are billed at $10 each per team level. At renewal, your cost will reflect your current roster counts. On the Athletic Director plan, roster size does not affect the flat $6,500 fee.",
  },
  {
    q: "Does the minimum roster size depend on the sport?",
    a: "Yes. Each sport has a minimum varsity roster size (e.g., Football 40, Basketball 10, Soccer 14). The calculator uses these minimums so your estimate matches how Braik will bill your program.",
  },
  {
    q: "What is included in the Athletic Director plan?",
    a: "The Athletic Director plan ($6,500/year) includes unlimited teams, unlimited roster spots, unlimited assistant coaches, the athletic director portal, organization and team management, and head coach invite codes—all under one annual payment from the athletic department.",
  },
  {
    q: "Can we start with Head Coach and upgrade to Athletic Director later?",
    a: "Yes. Many schools start with a Head Coach plan for one program and later move to the Athletic Director plan when they want one platform across every sport and centralized visibility.",
  },
] as const

export function PricingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-2">
          Pricing FAQ
        </h2>
        <p className="text-[#212529]/80">
          Common questions about Braik pricing and billing.
        </p>
      </div>

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={item.q}
            className={cn(
              "rounded-xl border-2 border-[#e5e7eb] bg-white overflow-hidden transition-all",
              openIndex === i && "border-[#3B82F6]/40 shadow-md"
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 py-4 px-5 text-left"
            >
              <span className="font-semibold text-[#212529]">{item.q}</span>
              <span
                className={cn(
                  "text-[#3B82F6] text-xl font-bold transition-transform shrink-0",
                  openIndex === i && "rotate-45"
                )}
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
                <div className="pb-4 px-5 pt-0 text-[#212529]/85 leading-relaxed border-t border-[#e5e7eb] space-y-2">
                  <p>{item.a}</p>
                  {"linkHref" in item && item.linkHref && item.linkLabel ? (
                    <p>
                      <Link href={item.linkHref} className="font-medium text-[#2563EB] hover:underline">
                        {item.linkLabel}
                      </Link>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
